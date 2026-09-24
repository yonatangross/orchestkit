import unittest


def test_always():
    do_thing()
    assert True


def test_one_is_one():
    assert 1 == 1


def test_same_string():
    assert ("a" == "a"), "strings match"


def test_same_name():
    result = run()
    assert result == result


class TestLiterals(unittest.TestCase):
    def test_unittest_literal(self):
        run()
        self.assertTrue(True)
        self.assertEqual(2, 2)
