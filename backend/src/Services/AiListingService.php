<?php

declare(strict_types=1);

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

class AiListingService
{
    private Client $http;
    private string $apiKey;
    private string $model;

    public function __construct()
    {
        $this->apiKey = $_ENV['GROQ_API_KEY'] ?? '';
        $this->model  = $_ENV['GROQ_MODEL'] ?? 'llama-3.1-8b-instant';
        $this->http   = new Client(['timeout' => 60]);
    }

    public function analyze(array $scrapedData): array
    {
        if (empty($this->apiKey)) {
            throw new \RuntimeException(
                'GROQ_API_KEY is not configured. Get a free key at https://console.groq.com'
            );
        }

        $prompt  = $this->buildPrompt($scrapedData);
        $rawText = $this->callGroq($prompt);
        return $this->parseResponse($rawText);
    }

    public function translate(string $title, string $description): array
    {
        if (empty($this->apiKey)) {
            throw new \RuntimeException('GROQ_API_KEY is not configured.');
        }

        $prompt = <<<PROMPT
Translate the following eBay listing from German to English.
Return ONLY valid JSON, no markdown, no explanation.

Title: {$title}

Description (HTML): {$description}

Return exactly:
{"title": "translated title here", "description": "translated HTML description here"}
PROMPT;

        $raw  = $this->callGroq($prompt);
        $data = json_decode(trim($raw), true);

        return [
            'title'       => $data['title']       ?? $title,
            'description' => $data['description'] ?? $description,
        ];
    }

    private function buildPrompt(array $d): string
    {
        $origin = match ($d['origin'] ?? 'UNKNOWN') {
            'CN'    => 'China (AliExpress / dropshipping supplier)',
            'DE'    => 'Germany (local stock, fast delivery)',
            default => 'Unknown — assume China/dropshipping to be safe',
        };

        $supplierPrice = !empty($d['price']['value'])
            ? $d['price']['value'] . ' ' . ($d['price']['currency'] ?? 'EUR')
            : 'not detected';

        $imageLines = implode("\n", array_slice($d['images'] ?? [], 0, 6));

        return <<<PROMPT
Du bist ein professioneller eBay.de-Verkäufer. Analysiere die Produktdaten unten und erstelle ein optimiertes deutsches eBay-Inserat.

=== PRODUKTDATEN ===
URL: {$d['url']}
Rohtitel: {$d['title']}
Rohbeschreibung: {$d['description']}
Lieferantenpreis: {$supplierPrice}
Versandherkunft: {$origin}
Gefundene Bilder:
{$imageLines}
Seitentext-Auszug:
{$d['text_snippet']}

=== REGELN ===
SPRACHE: Schreibe Titel, Beschreibung und Schlüsselwörter auf DEUTSCH.
1. TITEL: Max. 80 Zeichen. Wichtigste Suchbegriffe zuerst. Kein GROSSSCHRIFT, kein !, @, #, *.
2. ZUSTAND: "Neu" für AliExpress/Dropshipping. "Gebraucht - Wie neu" nur wenn Seite explizit "gebraucht" sagt.
3. BESCHREIBUNG: Professionelles HTML mit <ul><li>-Aufzählungen auf Deutsch. Hauptmerkmale, Lieferumfang, Kompatibilität. 150-250 Wörter. Mit kurzem Versandhinweis enden.
4. PREIS (EUR):
   - China: Lieferantenpreis mind. 2,8x multiplizieren. Ohne Preis: nach Produkttyp schätzen.
   - Deutschland: 1,6x multiplizieren.
   - Als String ausgeben z.B. "24.99".
5. VERSAND:
   - Deutschland: type=free, cost=0.00, service=Standardversand (eBay), Bearbeitung 1-2 Tage, Lieferung 1-2 Tage.
   - China: type=paid, cost=3.99, service=AliExpress Standardversand, Bearbeitung 5-7 Tage, Lieferung 15-25 Tage.
   - Unbekannt: China-Preset verwenden.
6. KATEGORIE: Bester eBay.de-Kategoriepfad, z.B. "Haustierbedarf > Hunde > Zubehör".
7. SCHLÜSSELWÖRTER: 6-10 deutsche Suchbegriffe die Käufer eingeben.
8. ARTIKELMERKMALE: Extrahiere ALLE passenden eBay-Artikelmerkmale aus den Produktdaten.
   IMMER angeben (für alle Produkttypen):
   - Marke: Produktmarke wenn erkennbar, sonst "Ohne Markenzeichen"
   - Farbe: Hauptfarbe auf Deutsch (z.B. "Schwarz", "Blau", "Beige")
   - Material: Hauptmaterial (z.B. "Polyester", "Baumwolle", "Kunststoff", "Aluminium")
   - Produktart: PFLICHT für alle Typen — z.B. "Rucksack", "Tasche", "Koffer", "Top", "Hose", "Lampe", "Kabel", "Halter", "Box", "Matte"

   Für Kleidung/Mode ZUSÄTZLICH:
   - Abteilung: "Damen", "Herren", "Kinder" oder "Unisex"
   - Größe: z.B. "M", "L", "XL", "One Size"
   - Stil: z.B. "Casual", "Elegant", "Sportlich", "Basic"
   - Ärmellänge: PFLICHT — "Ärmellos" für Westen/Tops/Träger, "Kurzarm" für T-Shirts, "Langarm" für Pullover, "3/4-Arm" usw.

   Für Taschen/Koffer/Behälter/Möbel/Geräte ZUSÄTZLICH (wenn in Produktdaten vorhanden):
   - Breite: Maß mit Einheit, z.B. "30 cm", "12 inch" — aus Produktspezifikationen entnehmen
   - Höhe: Maß mit Einheit, z.B. "45 cm"
   - Länge: Maß mit Einheit, z.B. "20 cm"
   - Fassungsvermögen: z.B. "20 L", "5 kg" — wenn angegeben

   Für Elektronik ZUSÄTZLICH: Modell, Kompatibilität, Anschlusstyp.
   Für Haustiere ZUSÄTZLICH: Tierart, Gewichtsklasse.

Gib NUR dieses JSON zurück, keine Erklärung, kein Markdown:
{
  "title": "string",
  "condition": "Neu",
  "description": "<ul><li>...</li></ul><p>...</p>",
  "price": { "value": "24.99", "currency": "EUR" },
  "shipping_origin": "CN",
  "shipping": {
    "type": "paid",
    "cost": "3.99",
    "service": "AliExpress Standardversand",
    "processing_days_min": 5,
    "processing_days_max": 7,
    "delivery_days_min": 15,
    "delivery_days_max": 25
  },
  "category_suggestion": "string",
  "keywords": ["string"],
  "item_specifics": {
    "Marke": "Ohne Markenzeichen",
    "Produktart": "Rucksack",
    "Farbe": "Schwarz",
    "Material": "Polyester",
    "Breite": "30 cm",
    "Höhe": "45 cm",
    "Länge": "15 cm"
  }
}
PROMPT;
    }

    private function callGroq(string $prompt): string
    {
        try {
            $response = $this->http->post('https://api.groq.com/openai/v1/chat/completions', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->apiKey,
                    'Content-Type'  => 'application/json',
                ],
                'json' => [
                    'model'       => $this->model,
                    'temperature' => 0.3,
                    'max_tokens'  => 2048,
                    'messages'    => [
                        [
                            'role'    => 'system',
                            'content' => 'You are a professional eBay seller assistant. Respond with valid JSON only — no markdown, no explanation, no code fences.',
                        ],
                        [
                            'role'    => 'user',
                            'content' => $prompt,
                        ],
                    ],
                ],
            ]);

            $body = json_decode((string) $response->getBody(), true);
            return $body['choices'][0]['message']['content'] ?? '';
        } catch (GuzzleException $e) {
            throw new \RuntimeException('Groq API error: ' . $e->getMessage());
        }
    }

    private function parseResponse(string $text): array
    {
        // Strip markdown fences if model added them despite instructions
        $text = preg_replace('/^```(?:json)?\s*/m', '', $text) ?? $text;
        $text = preg_replace('/\s*```$/m', '', $text) ?? $text;
        $text = trim($text);

        // Extract first JSON object if surrounded by extra text
        if (!str_starts_with($text, '{')) {
            preg_match('/\{[\s\S]+\}/', $text, $m);
            $text = $m[0] ?? $text;
        }

        $data = json_decode($text, true);
        if (!is_array($data)) {
            throw new \RuntimeException('AI returned invalid JSON. Raw: ' . mb_substr($text, 0, 300));
        }

        if (!empty($data['title']) && mb_strlen($data['title']) > 80) {
            $data['title'] = mb_substr($data['title'], 0, 80);
        }

        $origin = $data['shipping_origin'] ?? 'UNKNOWN';
        $data['condition']           ??= 'New';
        $data['shipping_origin']       = $origin;
        $data['price']               ??= ['value' => '', 'currency' => 'EUR'];
        $data['shipping']            ??= $this->defaultShipping($origin);
        $data['keywords']            ??= [];
        $data['category_suggestion'] ??= '';
        $data['description']         ??= '';
        if (empty($data['item_specifics']) || !is_array($data['item_specifics'])) {
            $data['item_specifics'] = ['Marke' => 'Ohne Markenzeichen'];
        }
        // Ensure Marke is always present
        if (empty($data['item_specifics']['Marke'])) {
            $data['item_specifics']['Marke'] = 'Ohne Markenzeichen';
        }

        return $data;
    }

    private function defaultShipping(string $origin): array
    {
        if ($origin === 'DE') {
            return [
                'type'                => 'free',
                'cost'                => '0.00',
                'service'             => 'Standardversand (eBay)',
                'processing_days_min' => 1,
                'processing_days_max' => 2,
                'delivery_days_min'   => 1,
                'delivery_days_max'   => 2,
            ];
        }

        return [
            'type'                => 'paid',
            'cost'                => '3.99',
            'service'             => 'AliExpress Standardversand',
            'processing_days_min' => 5,
            'processing_days_max' => 7,
            'delivery_days_min'   => 15,
            'delivery_days_max'   => 25,
        ];
    }
}
