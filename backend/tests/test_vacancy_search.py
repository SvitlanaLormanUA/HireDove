import pytest

from app.models.user import User, UserRole
from app.models.vacancy import ExperienceLevel, Vacancy, VacancyStatus, WorkFormat


@pytest.fixture
def employer(db_session):
    u = User(email="boss@example.com", hashed_password="x", full_name="Boss", role=UserRole.employer)
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture
def make_vacancy(db_session, employer):
    def _make(**kw):
        data = dict(
            employer_id=employer.id,
            title="Python Developer",
            company_name="Acme",
            description="Build APIs",
            location="Kyiv",
            work_format=WorkFormat.office,
            experience=ExperienceLevel.junior,
            industry="IT",
            status=VacancyStatus.active,
            is_hidden=False,
        )
        data.update(kw)
        v = Vacancy(**data)
        db_session.add(v)
        db_session.commit()
        return v

    return _make


def search(client, **params):
    r = client.get("/vacancies/search", params=params)
    assert r.status_code == 200, r.text
    return r.json()


def test_search_is_public_and_empty_state(client):
    body = search(client)
    assert body == {"items": [], "total": 0, "page": 1, "page_size": 10, "pages": 0}


def test_only_active_and_not_hidden(client, make_vacancy):
    make_vacancy(title="Visible")
    make_vacancy(title="Closed", status=VacancyStatus.closed)
    make_vacancy(title="Hidden", is_hidden=True)
    titles = [v["title"] for v in search(client)["items"]]
    assert titles == ["Visible"]


def test_text_query_matches_title_company_description(client, make_vacancy):
    make_vacancy(title="Designer", company_name="Acme", description="figma")
    make_vacancy(title="Cook", company_name="Zeta", description="kitchen")
    assert search(client, q="design")["total"] == 1
    assert search(client, q="zeta")["total"] == 1
    assert search(client, q="FIGMA")["total"] == 1
    assert search(client, q="nothing-like-this")["total"] == 0


def test_like_wildcards_are_escaped(client, make_vacancy):
    make_vacancy(title="100% remote")
    make_vacancy(title="Plain")
    assert search(client, q="%")["total"] == 1
    assert search(client, q="_")["total"] == 0


def test_filters_combine_with_and(client, make_vacancy):
    make_vacancy(title="A", location="Kyiv", work_format=WorkFormat.remote, experience=ExperienceLevel.none, industry="IT")
    make_vacancy(title="B", location="Kyiv", work_format=WorkFormat.office, experience=ExperienceLevel.none, industry="IT")
    make_vacancy(title="C", location="Lviv", work_format=WorkFormat.remote, experience=ExperienceLevel.senior, industry="Marketing")

    assert {v["title"] for v in search(client, location="Kyiv")["items"]} == {"A", "B"}
    assert {v["title"] for v in search(client, industry="Marketing")["items"]} == {"C"}
    assert {v["title"] for v in search(client, work_format="remote")["items"]} == {"A", "C"}
    assert {v["title"] for v in search(client, experience="none")["items"]} == {"A", "B"}
    # multi-select = OR inside one filter, AND between filters
    assert {v["title"] for v in search(client, work_format=["remote", "office"])["items"]} == {"A", "B", "C"}
    assert {v["title"] for v in search(client, work_format="remote", location="Kyiv")["items"]} == {"A"}


def test_invalid_filter_value_is_422(client):
    assert client.get("/vacancies/search", params={"work_format": "moon"}).status_code == 422
    assert client.get("/vacancies/search", params={"page": 0}).status_code == 422
    assert client.get("/vacancies/search", params={"page_size": 1000}).status_code == 422


def test_pagination_and_order_newest_first(client, make_vacancy):
    for i in range(25):
        make_vacancy(title=f"V{i:02d}")
    p1 = search(client, page=1, page_size=10)
    p3 = search(client, page=3, page_size=10)
    assert p1["total"] == 25 and p1["pages"] == 3
    assert len(p1["items"]) == 10 and len(p3["items"]) == 5
    # same created_at second -> tie broken by id desc, so newest inserted first
    assert p1["items"][0]["title"] == "V24"
    ids = [v["id"] for v in p1["items"]] + [v["id"] for v in search(client, page=2)["items"]] + [v["id"] for v in p3["items"]]
    assert len(set(ids)) == 25  # no overlaps between pages
    assert search(client, page=9)["items"] == []  # past the end: empty, not an error


def test_snippet_is_truncated(client, make_vacancy):
    make_vacancy(description="word " * 200)
    snippet = search(client)["items"][0]["snippet"]
    assert len(snippet) <= 180 and snippet.endswith("…")


def test_filter_options_only_from_visible(client, make_vacancy):
    make_vacancy(location="Kyiv", industry="IT")
    make_vacancy(location="Lviv", industry="IT")
    make_vacancy(location="Secret", industry="Hidden", is_hidden=True)
    r = client.get("/vacancies/filters")
    assert r.status_code == 200
    assert r.json() == {"locations": ["Kyiv", "Lviv"], "industries": ["IT"]}
