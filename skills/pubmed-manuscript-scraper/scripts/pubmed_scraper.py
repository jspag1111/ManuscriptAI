#!/usr/bin/env python3
"""Search PubMed and export article reference documents.

This script uses NCBI E-utilities (esearch + efetch) and mirrors the
ManuscriptAI query/record shape (PMID, title, journal, year, abstract, DOI).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
PUBMED_WEB_BASE = "https://pubmed.ncbi.nlm.nih.gov"


@dataclass
class PubMedSearchResult:
    ids: list[str]
    count: int


@dataclass
class PubMedArticle:
    pmid: str
    title: str
    abstract: str
    journal: str | None = None
    year: str | None = None
    pubdate: str | None = None
    doi: str | None = None
    authors: list[str] | None = None
    publication_types: list[str] | None = None

    @property
    def url(self) -> str:
        return f"{PUBMED_WEB_BASE}/{self.pmid}/"


def _clean_text(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(value.split())


def _join_itertext(element: ET.Element | None) -> str:
    if element is None:
        return ""
    return _clean_text("".join(element.itertext()))


def _extract_year(pubdate_el: ET.Element | None) -> str | None:
    if pubdate_el is None:
        return None
    year = _clean_text(pubdate_el.findtext("Year"))
    if year:
        return year
    medline_date = _clean_text(pubdate_el.findtext("MedlineDate"))
    if medline_date:
        year_match = re.search(r"\b(1[89]\d{2}|20\d{2})\b", medline_date)
        if year_match:
            return year_match.group(1)
    return None


def _extract_pubdate(pubdate_el: ET.Element | None) -> str | None:
    if pubdate_el is None:
        return None
    year = _clean_text(pubdate_el.findtext("Year"))
    month = _clean_text(pubdate_el.findtext("Month"))
    day = _clean_text(pubdate_el.findtext("Day"))
    parts = [part for part in [year, month, day] if part]
    if parts:
        return "-".join(parts)
    medline_date = _clean_text(pubdate_el.findtext("MedlineDate"))
    return medline_date or None


def _format_author(author_el: ET.Element) -> str:
    collective = _clean_text(author_el.findtext("CollectiveName"))
    if collective:
        return collective

    last_name = _clean_text(author_el.findtext("LastName"))
    fore_name = _clean_text(author_el.findtext("ForeName"))
    initials = _clean_text(author_el.findtext("Initials"))

    if last_name and fore_name:
        return f"{last_name}, {fore_name}"
    if last_name and initials:
        return f"{last_name}, {initials}"
    return last_name or fore_name or initials


def _chunk(values: list[str], size: int) -> list[list[str]]:
    if size <= 0:
        return [values]
    return [values[index : index + size] for index in range(0, len(values), size)]


class PubMedClient:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        email: str | None = None,
        tool: str | None = None,
        timeout_seconds: int = 30,
        throttle_seconds: float | None = None,
    ) -> None:
        self.api_key = api_key or os.getenv("NCBI_API_KEY")
        self.email = email or os.getenv("NCBI_EMAIL")
        self.tool = tool or os.getenv("NCBI_TOOL") or "ManuscriptAI"
        self.timeout_seconds = timeout_seconds
        # NCBI default rate guidance: <=3 req/s without key, <=10 req/s with key.
        self.throttle_seconds = throttle_seconds if throttle_seconds is not None else (0.12 if self.api_key else 0.34)

    def _common_params(self) -> dict[str, str]:
        params: dict[str, str] = {"tool": self.tool}
        if self.api_key:
            params["api_key"] = self.api_key
        if self.email:
            params["email"] = self.email
        return params

    def _build_url(self, endpoint: str, params: dict[str, str]) -> str:
        merged = {**self._common_params(), **params}
        encoded = urllib.parse.urlencode({k: v for k, v in merged.items() if v})
        return f"{EUTILS_BASE}/{endpoint}?{encoded}"

    def _request_json(self, endpoint: str, params: dict[str, str]) -> dict[str, Any]:
        if self.throttle_seconds > 0:
            time.sleep(self.throttle_seconds)

        url = self._build_url(endpoint, params)
        try:
            with urllib.request.urlopen(url, timeout=self.timeout_seconds) as response:
                payload = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace") if exc.fp else str(exc)
            raise RuntimeError(f"PubMed {endpoint} failed ({exc.code}): {detail}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"PubMed {endpoint} request error: {exc.reason}") from exc

        try:
            return json.loads(payload)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Invalid JSON response from {endpoint}: {exc}") from exc

    def _request_text(self, endpoint: str, params: dict[str, str]) -> str:
        if self.throttle_seconds > 0:
            time.sleep(self.throttle_seconds)

        url = self._build_url(endpoint, params)
        try:
            with urllib.request.urlopen(url, timeout=self.timeout_seconds) as response:
                return response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace") if exc.fp else str(exc)
            raise RuntimeError(f"PubMed {endpoint} failed ({exc.code}): {detail}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"PubMed {endpoint} request error: {exc.reason}") from exc

    def search(self, *, term: str, retmax: int = 20, sort: str = "relevance", retstart: int = 0) -> PubMedSearchResult:
        sort_param = "pub+date" if sort == "pub_date" else "relevance"
        clamped_retmax = max(1, min(200, retmax))
        payload = self._request_json(
            "esearch.fcgi",
            {
                "db": "pubmed",
                "term": term,
                "retmode": "json",
                "retmax": str(clamped_retmax),
                "retstart": str(max(0, retstart)),
                "sort": sort_param,
            },
        )

        result = payload.get("esearchresult") or {}
        ids = result.get("idlist") if isinstance(result.get("idlist"), list) else []
        id_strings = [str(item) for item in ids]

        try:
            count = int(result.get("count", len(id_strings)))
        except (TypeError, ValueError):
            count = len(id_strings)

        return PubMedSearchResult(ids=id_strings, count=count)

    def fetch_abstracts(self, pmids: list[str], batch_size: int = 80) -> list[PubMedArticle]:
        unique = list(dict.fromkeys([pmid for pmid in pmids if pmid]))
        if not unique:
            return []

        articles: list[PubMedArticle] = []
        for pmid_batch in _chunk(unique, batch_size):
            xml_payload = self._request_text(
                "efetch.fcgi",
                {
                    "db": "pubmed",
                    "id": ",".join(pmid_batch),
                    "retmode": "xml",
                },
            )
            articles.extend(parse_efetch_xml(xml_payload))

        return articles


def build_pubmed_query(
    base_query: str,
    *,
    year_from: int | None = None,
    year_to: int | None = None,
    article_types: list[str] | None = None,
    language: str | None = None,
    journal: str | None = None,
    humans_only: bool = False,
    exclude_case_reports: bool = False,
    exclude_animal_only: bool = False,
    must_include: list[str] | None = None,
    must_exclude: list[str] | None = None,
) -> str:
    query = base_query.strip()
    if not query:
        raise ValueError("base_query must not be empty")

    parts = [f"({query})"]

    if year_from is not None or year_to is not None:
        from_year = str(year_from if year_from is not None else 1800)
        to_year = str(year_to if year_to is not None else datetime.now(tz=timezone.utc).year)
        parts.append(f"AND (\"{from_year}\"[Date - Publication] : \"{to_year}\"[Date - Publication])")

    if language:
        parts.append(f"AND {language.strip()}[lang]")

    if journal:
        parts.append(f"AND \"{journal.strip()}\"[jour]")

    if article_types:
        cleaned_types = [article_type.strip() for article_type in article_types if article_type and article_type.strip()]
        if cleaned_types:
            article_parts = [f'"{article_type}"[pt]' for article_type in cleaned_types]
            parts.append(f"AND ({' OR '.join(article_parts)})")

    if humans_only:
        parts.append("AND humans[mh]")

    if exclude_case_reports:
        parts.append("NOT (\"Case Reports\"[pt])")

    if exclude_animal_only:
        parts.append("NOT (animals[mh] NOT humans[mh])")

    for include_filter in must_include or []:
        token = include_filter.strip()
        if token:
            parts.append(f"AND ({token})")

    for exclude_filter in must_exclude or []:
        token = exclude_filter.strip()
        if token:
            parts.append(f"NOT ({token})")

    return " ".join(parts)


def parse_efetch_xml(xml_payload: str) -> list[PubMedArticle]:
    try:
        root = ET.fromstring(xml_payload)
    except ET.ParseError as exc:
        raise RuntimeError(f"Unable to parse PubMed XML: {exc}") from exc

    parsed: list[PubMedArticle] = []

    for article_node in root.findall(".//PubmedArticle"):
        medline = article_node.find("MedlineCitation")
        if medline is None:
            continue

        pmid = _clean_text(medline.findtext("PMID"))
        if not pmid:
            continue

        article = medline.find("Article")
        if article is None:
            continue

        title = _join_itertext(article.find("ArticleTitle"))
        journal = _join_itertext(article.find("Journal/Title")) or _join_itertext(article.find("Journal/ISOAbbreviation"))

        pubdate_node = article.find("Journal/JournalIssue/PubDate")
        year = _extract_year(pubdate_node)
        pubdate = _extract_pubdate(pubdate_node)

        abstract_parts: list[str] = []
        for abstract_text_node in article.findall("Abstract/AbstractText"):
            label = _clean_text(abstract_text_node.attrib.get("Label"))
            value = _join_itertext(abstract_text_node)
            if not value:
                continue
            abstract_parts.append(f"{label}: {value}" if label else value)

        doi = None
        for article_id in article_node.findall("PubmedData/ArticleIdList/ArticleId"):
            if article_id.attrib.get("IdType", "").lower() == "doi":
                doi = _join_itertext(article_id) or None
                if doi:
                    break

        authors: list[str] = []
        for author_node in article.findall("AuthorList/Author"):
            formatted = _format_author(author_node)
            if formatted:
                authors.append(formatted)

        publication_types = [
            _join_itertext(pub_type)
            for pub_type in article.findall("PublicationTypeList/PublicationType")
            if _join_itertext(pub_type)
        ]

        parsed.append(
            PubMedArticle(
                pmid=pmid,
                title=title,
                abstract="\n".join(abstract_parts),
                journal=journal or None,
                year=year,
                pubdate=pubdate,
                doi=doi,
                authors=authors or None,
                publication_types=publication_types or None,
            )
        )

    return parsed


def write_reference_documents(
    articles: list[PubMedArticle],
    *,
    output_dir: Path,
    output_prefix: str,
    final_query: str,
    search_count: int,
) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    payload = {
        "generated_at": timestamp,
        "query": final_query,
        "returned_count": len(articles),
        "total_count": search_count,
        "articles": [
            {
                **asdict(article),
                "url": article.url,
            }
            for article in articles
        ],
    }

    json_path = output_dir / f"{output_prefix}.json"
    with json_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)

    markdown_path = output_dir / f"{output_prefix}.md"
    markdown_lines: list[str] = [
        "# PubMed Reference Pack",
        "",
        f"- Generated at: {timestamp}",
        f"- Query: `{final_query}`",
        f"- Results returned: {len(articles)} of {search_count}",
        "",
    ]

    for article in articles:
        authors_preview = ", ".join(article.authors or []) or "Unknown authors"
        publication_types = ", ".join(article.publication_types or []) or "Not listed"
        markdown_lines.extend(
            [
                f"## PMID {article.pmid}: {article.title or '(No title)'}",
                "",
                f"- URL: {article.url}",
                f"- Journal: {article.journal or 'Unknown journal'}",
                f"- Publication year: {article.year or 'Unknown'}",
                f"- Publication date: {article.pubdate or 'Unknown'}",
                f"- DOI: {article.doi or 'Not available'}",
                f"- Authors: {authors_preview}",
                f"- Publication types: {publication_types}",
                "",
                "### Abstract",
                "",
                article.abstract or "No abstract provided by PubMed.",
                "",
            ]
        )

    markdown_path.write_text("\n".join(markdown_lines), encoding="utf-8")

    context_path = output_dir / f"{output_prefix}.context.md"
    context_lines: list[str] = [
        "# PubMed Context Summary",
        "",
        "Use this file as model context when drafting literature reviews.",
        f"Query used: `{final_query}`",
        "",
    ]

    for article in articles:
        summary_bits = [
            f"PMID {article.pmid}",
            article.year or "year unknown",
            article.journal or "journal unknown",
        ]
        citation_line = " | ".join(summary_bits)
        context_lines.append(f"## {citation_line}")
        context_lines.append("")
        context_lines.append(f"Title: {article.title or 'No title'}")
        if article.doi:
            context_lines.append(f"DOI: {article.doi}")
        context_lines.append(f"URL: {article.url}")
        context_lines.append("Abstract:")
        context_lines.append(article.abstract or "No abstract provided by PubMed.")
        context_lines.append("")

    context_path.write_text("\n".join(context_lines), encoding="utf-8")

    return {
        "json": json_path,
        "markdown": markdown_path,
        "context": context_path,
    }


def _build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Search PubMed and export abstracts/title metadata into reference documents.",
    )
    parser.add_argument("--query", required=True, help="Base PubMed query (keywords and field tags).")
    parser.add_argument("--year-from", type=int, default=None, help="Publication year lower bound.")
    parser.add_argument("--year-to", type=int, default=None, help="Publication year upper bound.")
    parser.add_argument(
        "--article-type",
        action="append",
        default=[],
        help="Repeatable PubMed publication type filter, e.g. 'Randomized Controlled Trial'.",
    )
    parser.add_argument("--language", default=None, help="Language tag value, e.g. english.")
    parser.add_argument("--journal", default=None, help="Journal name filter for [jour].")
    parser.add_argument("--humans-only", action="store_true", help="Add humans[mh].")
    parser.add_argument("--exclude-case-reports", action="store_true", help="Exclude case reports publication type.")
    parser.add_argument(
        "--exclude-animal-only",
        action="store_true",
        help="Exclude animal-only studies with NOT (animals[mh] NOT humans[mh]).",
    )
    parser.add_argument(
        "--must-include",
        action="append",
        default=[],
        help="Repeatable query fragment that must be included, e.g. 'double blind[tiab]'.",
    )
    parser.add_argument(
        "--must-exclude",
        action="append",
        default=[],
        help="Repeatable query fragment that must be excluded, e.g. 'protocol[pt]'.",
    )
    parser.add_argument("--retmax", type=int, default=20, help="Number of records to fetch (1-200).")
    parser.add_argument(
        "--sort",
        choices=["relevance", "pub_date"],
        default="relevance",
        help="Sort by relevance or publication date.",
    )
    parser.add_argument(
        "--output-dir",
        default="pubmed_output",
        help="Directory where reference documents are written.",
    )
    parser.add_argument(
        "--output-prefix",
        default="pubmed_results",
        help="Filename prefix for .json/.md/.context.md output files.",
    )
    parser.add_argument(
        "--no-files",
        action="store_true",
        help="Skip file generation and print JSON to stdout only.",
    )
    parser.add_argument("--api-key", default=None, help="Optional NCBI API key. Defaults to NCBI_API_KEY env var.")
    parser.add_argument("--email", default=None, help="Optional contact email. Defaults to NCBI_EMAIL env var.")
    parser.add_argument("--tool", default=None, help="Optional tool name. Defaults to NCBI_TOOL or ManuscriptAI.")
    parser.add_argument("--timeout-seconds", type=int, default=30, help="HTTP timeout in seconds.")
    parser.add_argument(
        "--throttle-seconds",
        type=float,
        default=None,
        help="Request delay between API calls. Default: 0.34 without API key, 0.12 with key.",
    )
    return parser


def run_from_args(args: argparse.Namespace) -> dict[str, Any]:
    final_query = build_pubmed_query(
        args.query,
        year_from=args.year_from,
        year_to=args.year_to,
        article_types=args.article_type,
        language=args.language,
        journal=args.journal,
        humans_only=args.humans_only,
        exclude_case_reports=args.exclude_case_reports,
        exclude_animal_only=args.exclude_animal_only,
        must_include=args.must_include,
        must_exclude=args.must_exclude,
    )

    client = PubMedClient(
        api_key=args.api_key,
        email=args.email,
        tool=args.tool,
        timeout_seconds=args.timeout_seconds,
        throttle_seconds=args.throttle_seconds,
    )

    search = client.search(term=final_query, retmax=args.retmax, sort=args.sort)
    articles = client.fetch_abstracts(search.ids)

    result = {
        "query": final_query,
        "count": search.count,
        "returned": len(articles),
        "articles": [
            {
                **asdict(article),
                "url": article.url,
            }
            for article in articles
        ],
    }

    if not args.no_files:
        output_paths = write_reference_documents(
            articles,
            output_dir=Path(args.output_dir),
            output_prefix=args.output_prefix,
            final_query=final_query,
            search_count=search.count,
        )
        result["reference_files"] = {name: str(path) for name, path in output_paths.items()}

    return result


def main() -> int:
    parser = _build_argument_parser()
    args = parser.parse_args()

    try:
        result = run_from_args(args)
    except Exception as exc:  # noqa: BLE001 - CLI entrypoint should surface readable errors.
        print(f"ERROR: {exc}")
        return 1

    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
