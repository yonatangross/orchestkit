# Infrastructure as Code

Terraform and IaC best practices.

## Terraform Basics

```hcl
# main.tf
terraform {
  required_version = ">= 1.5"
  backend "s3" {
    bucket = "terraform-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_instance" "app" {
  ami           = "ami-12345678"
  instance_type = "t3.micro"

  tags = {
    Name = "app-server"
    Environment = "production"
  }
}
```

## Best Practices

1. **Remote state** - S3 + DynamoDB locking
2. **Modules** - reusable components
3. **Workspaces** - dev/staging/prod
4. **Variables** - no hardcoded values
5. **Version pinning** - lock provider versions

## Commands

```bash
terraform init
terraform plan
terraform apply
terraform destroy
```

See `templates/terraform-aws.tf` for complete examples.
