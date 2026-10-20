import pytest

from app.core.github_client import parse_github_url


@pytest.mark.parametrize(
    "url",
    [
        "https://github.com/bottlepy/bottle",
        "https://github.com/bottlepy/bottle/",
        "https://github.com/bottlepy/bottle.git",
        "http://www.github.com/bottlepy/bottle",
        "github.com/bottlepy/bottle",
        "bottlepy/bottle",
        "  bottlepy/bottle  ",
        "https://github.com/github.com/bottlepy/bottle",
    ],
)
def test_parse_valid_urls(url):
    assert parse_github_url(url) == ("bottlepy", "bottle")


@pytest.mark.parametrize("url", ["", "not a url", "https://gitlab.com/a/b", "a/b/c"])
def test_parse_invalid_urls(url):
    with pytest.raises(ValueError):
        parse_github_url(url)
