import { extractLdJson } from '../lambda/auckland_kids/scraper';

describe('Auckland for Kids Scraper', () => {
  it('should extract structured data from LD+JSON', () => {
    const html = `
      <html>
        <body>
          <script type="application/ld+json">
            {
              "@context": "http://schema.org",
              "@type": "Event",
              "name": "Family Fun Day",
              "startDate": "2026-05-16T10:00:00+12:00",
              "endDate": "2026-05-16T14:00:00+12:00",
              "location": {
                "@type": "Place",
                "name": "Western Springs Park",
                "address": {
                  "@type": "PostalAddress",
                  "streetAddress": "731 Great North Road"
                }
              }
            }
          </script>
        </body>
      </html>
    `;
    
    const data = extractLdJson(html);
    expect(data).toBeDefined();
    expect(data?.name).toBe('Family Fun Day');
    expect(data?.startDate).toBe('2026-05-16T10:00:00+12:00');
    expect(data?.locationName).toBe('Western Springs Park');
    expect(data?.streetAddress).toBe('731 Great North Road');
  });

  it('should return null if no LD+JSON Event is found', () => {
    const html = '<html><body></body></html>';
    const data = extractLdJson(html);
    expect(data).toBeNull();
  });
});
