#!/usr/bin/env python3
"""
ORM Model Change Detector
Detects SQLAlchemy model changes to help generate migrations
Usage: ./detect-model-changes.py [models-path] [--json]
"""

import argparse
import ast
import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ModelField:
    """Represents a model field."""

    name: str
    field_type: str
    nullable: bool = True
    primary_key: bool = False
    foreign_key: str | None = None
    index: bool = False
    unique: bool = False
    default: str | None = None


@dataclass
class ModelInfo:
    """Represents a SQLAlchemy model."""

    name: str
    table_name: str | None
    file_path: str
    fields: list[ModelField] = field(default_factory=list)
    relationships: list[str] = field(default_factory=list)
    indexes: list[str] = field(default_factory=list)


@dataclass
class ChangeReport:
    """Report of detected changes."""

    models: list[ModelInfo] = field(default_factory=list)
    new_files: list[str] = field(default_factory=list)
    modified_files: list[str] = field(default_factory=list)
    git_changes: list[str] = field(default_factory=list)


class ModelVisitor(ast.NodeVisitor):
    """AST visitor to extract model information."""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.models: list[ModelInfo] = []
        self.current_class: str | None = None

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        # Check if this is a SQLAlchemy model
        is_model = False
        for base in node.bases:
            base_name = ""
            if isinstance(base, ast.Name):
                base_name = base.id
            elif isinstance(base, ast.Attribute):
                base_name = base.attr

            if base_name in ("Base", "Model", "DeclarativeBase"):
                is_model = True
                break

        if not is_model:
            # Check for __tablename__ as another indicator
            for item in node.body:
                if isinstance(item, ast.Assign):
                    for target in item.targets:
                        if isinstance(target, ast.Name) and target.id == "__tablename__":
                            is_model = True
                            break

        if is_model:
            model = ModelInfo(name=node.name, table_name=None, file_path=self.file_path)

            for item in node.body:
                self._process_class_body(item, model)

            self.models.append(model)

        self.generic_visit(node)

    def _process_class_body(self, item: ast.stmt, model: ModelInfo) -> None:
        # Extract __tablename__
        if isinstance(item, ast.Assign):
            for target in item.targets:
                if (
                    isinstance(target, ast.Name)
                    and target.id == "__tablename__"
                    and isinstance(item.value, ast.Constant)
                ):
                    model.table_name = item.value.value

        # Extract fields (annotated assignments like: field: Mapped[str] = ...)
        if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
            field_info = self._parse_field(item)
            if field_info:
                model.fields.append(field_info)

        # Extract relationships
        if (
            isinstance(item, ast.AnnAssign)
            and self._is_relationship(item)
            and isinstance(item.target, ast.Name)
        ):
            model.relationships.append(item.target.id)

    def _parse_field(self, node: ast.AnnAssign) -> ModelField | None:
        if not isinstance(node.target, ast.Name):
            return None

        field_name = node.target.id

        # Skip private fields and relationships
        if field_name.startswith("_"):
            return None

        # Parse the type annotation
        field_type = "unknown"
        if isinstance(node.annotation, ast.Subscript):
            # Handle Mapped[Type]
            if isinstance(node.annotation.slice, ast.Name):
                field_type = node.annotation.slice.id
            elif (
                isinstance(node.annotation.slice, ast.Subscript)
                and isinstance(node.annotation.slice.value, ast.Name)
            ):
                # Handle Mapped[Optional[Type]] or Mapped[list[Type]]
                field_type = node.annotation.slice.value.id
        elif isinstance(node.annotation, ast.Name):
            field_type = node.annotation.id

        # Parse the value (mapped_column(...))
        nullable = True
        primary_key = False
        foreign_key = None
        index = False
        unique = False
        default = None

        if node.value and isinstance(node.value, ast.Call):
            func_name = ""
            if isinstance(node.value.func, ast.Name):
                func_name = node.value.func.id
            elif isinstance(node.value.func, ast.Attribute):
                func_name = node.value.func.attr

            if func_name in ("mapped_column", "Column"):
                for keyword in node.value.keywords:
                    if keyword.arg == "nullable" and isinstance(keyword.value, ast.Constant):
                        nullable = keyword.value.value
                    elif keyword.arg == "primary_key" and isinstance(keyword.value, ast.Constant):
                        primary_key = keyword.value.value
                    elif keyword.arg == "index" and isinstance(keyword.value, ast.Constant):
                        index = keyword.value.value
                    elif keyword.arg == "unique" and isinstance(keyword.value, ast.Constant):
                        unique = keyword.value.value
                    elif keyword.arg == "default":
                        default = ast.unparse(keyword.value)

                # Check for ForeignKey in positional args
                for arg in node.value.args:
                    if (
                        isinstance(arg, ast.Call)
                        and isinstance(arg.func, ast.Name)
                        and arg.func.id == "ForeignKey"
                        and arg.args
                        and isinstance(arg.args[0], ast.Constant)
                    ):
                        foreign_key = arg.args[0].value

        return ModelField(
            name=field_name,
            field_type=field_type,
            nullable=nullable,
            primary_key=primary_key,
            foreign_key=foreign_key,
            index=index,
            unique=unique,
            default=default,
        )

    def _is_relationship(self, node: ast.AnnAssign) -> bool:
        """Check if this is a relationship field."""
        if isinstance(node.value, ast.Call):
            func = node.value.func
            if isinstance(func, ast.Name) and func.id == "relationship":
                return True
            if isinstance(func, ast.Attribute) and func.attr == "relationship":
                return True
        return False


def find_model_files(base_path: Path) -> list[Path]:
    """Find Python files likely containing SQLAlchemy models."""
    model_files = []

    patterns = ["**/models.py", "**/models/*.py", "**/model.py", "**/entities.py", "**/entities/*.py"]

    for pattern in patterns:
        model_files.extend(base_path.glob(pattern))

    # Also check for files with 'model' in the name
    for py_file in base_path.rglob("*.py"):
        if "model" in py_file.name.lower() and py_file not in model_files:
            # Quick check if file contains SQLAlchemy imports
            try:
                content = py_file.read_text()
                if "sqlalchemy" in content or "Mapped" in content or "__tablename__" in content:
                    model_files.append(py_file)
            except (OSError, UnicodeDecodeError):
                pass

    return sorted(set(model_files))


def parse_model_file(file_path: Path) -> list[ModelInfo]:
    """Parse a Python file and extract model information."""
    try:
        source = file_path.read_text()
        tree = ast.parse(source)

        visitor = ModelVisitor(str(file_path))
        visitor.visit(tree)

        return visitor.models
    except (SyntaxError, OSError) as e:
        print(f"Warning: Could not parse {file_path}: {e}", file=sys.stderr)
        return []


def get_git_model_changes(base_path: Path) -> tuple[list[str], list[str], list[str]]:
    """Get git changes related to model files."""
    try:
        # Get recently changed model files
        result = subprocess.run(
            ["git", "-C", str(base_path), "diff", "--name-only", "HEAD~5"],
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            return [], [], []

        all_changes = result.stdout.strip().split("\n")
        model_changes = [f for f in all_changes if "model" in f.lower() and f.endswith(".py")]

        # Get staged changes
        result = subprocess.run(
            ["git", "-C", str(base_path), "diff", "--cached", "--name-only"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        staged = result.stdout.strip().split("\n") if result.returncode == 0 else []
        staged_models = [f for f in staged if "model" in f.lower() and f.endswith(".py")]

        # Get untracked files
        result = subprocess.run(
            ["git", "-C", str(base_path), "ls-files", "--others", "--exclude-standard"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        untracked = result.stdout.strip().split("\n") if result.returncode == 0 else []
        new_models = [f for f in untracked if "model" in f.lower() and f.endswith(".py")]

        return model_changes, staged_models, new_models

    except (subprocess.TimeoutExpired, FileNotFoundError):
        return [], [], []


def get_alembic_status(base_path: Path) -> dict:
    """Get current Alembic migration status."""
    try:
        result = subprocess.run(
            ["alembic", "current"],
            capture_output=True,
            text=True,
            cwd=base_path,
            timeout=30,
        )

        current_revision = "unknown"
        if result.returncode == 0:
            match = re.search(r"([a-f0-9]+)", result.stdout)
            if match:
                current_revision = match.group(1)

        return {"current_revision": current_revision, "available": True}
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return {"current_revision": None, "available": False}


def generate_migration_hint(models: list[ModelInfo]) -> str:
    """Generate suggested Alembic migration commands."""
    hints = []

    for model in models:
        if model.table_name:
            # New table
            columns = []
            for field in model.fields:
                col_def = f"sa.Column('{field.name}', sa.{field.field_type}()"
                if field.primary_key:
                    col_def += ", primary_key=True"
                if not field.nullable:
                    col_def += ", nullable=False"
                if field.unique:
                    col_def += ", unique=True"
                if field.index:
                    col_def += ", index=True"
                if field.foreign_key:
                    col_def += f", sa.ForeignKey('{field.foreign_key}')"
                col_def += ")"
                columns.append(col_def)

            hints.append(f"# Create table: {model.table_name}")
            hints.append(f"op.create_table('{model.table_name}',")
            for col in columns:
                hints.append(f"    {col},")
            hints.append(")")
            hints.append("")

    return "\n".join(hints)


def main():
    parser = argparse.ArgumentParser(description="Detect SQLAlchemy model changes")
    parser.add_argument("path", nargs="?", default=".", help="Path to search for models")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    base_path = Path(args.path).resolve()
    if not base_path.exists():
        print(f"Error: Path '{base_path}' does not exist", file=sys.stderr)
        sys.exit(1)

    # Find and parse model files
    model_files = find_model_files(base_path)
    all_models: list[ModelInfo] = []

    for file_path in model_files:
        models = parse_model_file(file_path)
        all_models.extend(models)

    # Get git changes
    changed, staged, new = get_git_model_changes(base_path)

    # Get Alembic status
    alembic = get_alembic_status(base_path)

    if args.json:
        output = {
            "models": [
                {
                    "name": m.name,
                    "table_name": m.table_name,
                    "file": m.file_path,
                    "fields": [
                        {
                            "name": f.name,
                            "type": f.field_type,
                            "nullable": f.nullable,
                            "primary_key": f.primary_key,
                            "foreign_key": f.foreign_key,
                            "index": f.index,
                            "unique": f.unique,
                        }
                        for f in m.fields
                    ],
                    "relationships": m.relationships,
                }
                for m in all_models
            ],
            "git_changes": {
                "recent": changed,
                "staged": staged,
                "new": new,
            },
            "alembic": alembic,
        }
        print(json.dumps(output, indent=2))
    else:
        print("=" * 60)
        print("           MODEL CHANGE DETECTION REPORT")
        print("=" * 60)
        print()

        print(f"ALEMBIC STATUS: {alembic['current_revision'] or 'Not found'}")
        print()

        print("DETECTED MODELS")
        print("-" * 40)
        for model in all_models:
            print(f"\n{model.name} -> {model.table_name or 'NO TABLE NAME'}")
            print(f"  File: {model.file_path}")
            print("  Fields:")
            for field in model.fields:
                flags = []
                if field.primary_key:
                    flags.append("PK")
                if not field.nullable:
                    flags.append("NOT NULL")
                if field.unique:
                    flags.append("UNIQUE")
                if field.index:
                    flags.append("INDEX")
                if field.foreign_key:
                    flags.append(f"FK->{field.foreign_key}")

                flag_str = f" [{', '.join(flags)}]" if flags else ""
                print(f"    - {field.name}: {field.field_type}{flag_str}")

            if model.relationships:
                print(f"  Relationships: {', '.join(model.relationships)}")
        print()

        if changed or staged or new:
            print("GIT CHANGES")
            print("-" * 40)
            if new:
                print("New model files:")
                for f in new:
                    print(f"  + {f}")
            if staged:
                print("Staged changes:")
                for f in staged:
                    print(f"  ~ {f}")
            if changed:
                print("Recently modified:")
                for f in changed:
                    print(f"  M {f}")
            print()

        print("SUGGESTED MIGRATION")
        print("-" * 40)
        print("Run: alembic revision --autogenerate -m 'description'")
        print()

        if all_models:
            print("Migration hints:")
            print(generate_migration_hint(all_models))

        print("=" * 60)


if __name__ == "__main__":
    main()
