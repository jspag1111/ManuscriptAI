import json
import tempfile
import unittest
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pubmed_scraper import PubMedArticle, build_pubmed_query, parse_efetch_xml, write_reference_documents


SAMPLE_EFETCH_XML = """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>12345678</PMID>
      <Article>
        <ArticleTitle>Trial title with <i>markup</i></ArticleTitle>
        <Journal>
          <JournalIssue>
            <PubDate>
              <Year>2024</Year>
              <Month>Nov</Month>
              <Day>15</Day>
            </PubDate>
          </JournalIssue>
          <Title>New England Journal of Medicine</Title>
        </Journal>
        <Abstract>
          <AbstractText Label=\"Background\">First paragraph.</AbstractText>
          <AbstractText Label=\"Results\">Second paragraph.</AbstractText>
        </Abstract>
        <AuthorList>
          <Author>
            <LastName>Doe</LastName>
            <ForeName>Jane</ForeName>
          </Author>
          <Author>
            <CollectiveName>The Study Group</CollectiveName>
          </Author>
        </AuthorList>
        <PublicationTypeList>
          <PublicationType>Randomized Controlled Trial</PublicationType>
          <PublicationType>Journal Article</PublicationType>
        </PublicationTypeList>
      </Article>
    </MedlineCitation>
    <PubmedData>
      <ArticleIdList>
        <ArticleId IdType=\"doi\">10.1000/test</ArticleId>
      </ArticleIdList>
    </PubmedData>
  </PubmedArticle>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>87654321</PMID>
      <Article>
        <ArticleTitle>Second title</ArticleTitle>
        <Journal>
          <JournalIssue>
            <PubDate>
              <MedlineDate>2018 Jan-Feb</MedlineDate>
            </PubDate>
          </JournalIssue>
          <ISOAbbreviation>Circulation</ISOAbbreviation>
        </Journal>
      </Article>
    </MedlineCitation>
    <PubmedData>
      <ArticleIdList>
        <ArticleId IdType=\"pubmed\">87654321</ArticleId>
      </ArticleIdList>
    </PubmedData>
  </PubmedArticle>
</PubmedArticleSet>
"""


class PubMedScraperTests(unittest.TestCase):
    def test_build_pubmed_query_applies_all_supported_filters(self) -> None:
        query = build_pubmed_query(
            "heart failure[tiab]",
            year_from=2020,
            year_to=2025,
            article_types=["Randomized Controlled Trial", "Meta-Analysis"],
            language="english",
            journal="Circulation",
            humans_only=True,
            exclude_case_reports=True,
            exclude_animal_only=True,
            must_include=["double blind[tiab]"],
            must_exclude=["protocol[ti]"],
        )

        self.assertIn("(heart failure[tiab])", query)
        self.assertIn('("2020"[Date - Publication] : "2025"[Date - Publication])', query)
        self.assertIn("english[lang]", query)
        self.assertIn('"Circulation"[jour]', query)
        self.assertIn('"Randomized Controlled Trial"[pt]', query)
        self.assertIn('"Meta-Analysis"[pt]', query)
        self.assertIn("humans[mh]", query)
        self.assertIn('NOT ("Case Reports"[pt])', query)
        self.assertIn("NOT (animals[mh] NOT humans[mh])", query)
        self.assertIn("AND (double blind[tiab])", query)
        self.assertIn("NOT (protocol[ti])", query)

    def test_parse_efetch_xml_extracts_expected_article_fields(self) -> None:
        records = parse_efetch_xml(SAMPLE_EFETCH_XML)
        self.assertEqual(len(records), 2)

        first = records[0]
        self.assertEqual(first.pmid, "12345678")
        self.assertEqual(first.title, "Trial title with markup")
        self.assertEqual(first.journal, "New England Journal of Medicine")
        self.assertEqual(first.year, "2024")
        self.assertEqual(first.pubdate, "2024-Nov-15")
        self.assertEqual(first.doi, "10.1000/test")
        self.assertIn("Background: First paragraph.", first.abstract)
        self.assertIn("Results: Second paragraph.", first.abstract)
        self.assertEqual(first.authors, ["Doe, Jane", "The Study Group"])
        self.assertEqual(first.publication_types, ["Randomized Controlled Trial", "Journal Article"])

        second = records[1]
        self.assertEqual(second.pmid, "87654321")
        self.assertEqual(second.journal, "Circulation")
        self.assertEqual(second.year, "2018")

    def test_write_reference_documents_creates_json_and_markdown_outputs(self) -> None:
        article = PubMedArticle(
            pmid="11223344",
            title="Example title",
            abstract="Example abstract text",
            journal="BMJ",
            year="2023",
            pubdate="2023-Jun-01",
            doi="10.1234/example",
            authors=["Smith, Alex"],
            publication_types=["Journal Article"],
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            paths = write_reference_documents(
                [article],
                output_dir=Path(temp_dir),
                output_prefix="run01",
                final_query="(hypertension[tiab])",
                search_count=10,
            )

            self.assertTrue(paths["json"].exists())
            self.assertTrue(paths["markdown"].exists())
            self.assertTrue(paths["context"].exists())

            payload = json.loads(paths["json"].read_text(encoding="utf-8"))
            self.assertEqual(payload["returned_count"], 1)
            self.assertEqual(payload["articles"][0]["pmid"], "11223344")
            self.assertEqual(payload["articles"][0]["url"], "https://pubmed.ncbi.nlm.nih.gov/11223344/")

            markdown = paths["markdown"].read_text(encoding="utf-8")
            self.assertIn("PMID 11223344", markdown)
            self.assertIn("Example abstract text", markdown)

            context = paths["context"].read_text(encoding="utf-8")
            self.assertIn("PubMed Context Summary", context)
            self.assertIn("Title: Example title", context)


if __name__ == "__main__":
    unittest.main()
