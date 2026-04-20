<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Services\AiListingService;
use App\Services\ProductScraperService;

class AiController
{
    public function __construct(
        private readonly ProductScraperService $scraper,
        private readonly AiListingService $aiService,
    ) {}

    public function analyze(array $params): void
    {
        $body = json_decode((string) file_get_contents('php://input'), true) ?? [];
        $url  = trim((string) ($body['url'] ?? ''));

        if ($url === '') {
            Response::error('url is required.', 422);
            return;
        }

        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            Response::error('Invalid URL format.', 422);
            return;
        }

        try {
            $scraped    = $this->scraper->scrape($url);
            $suggestion = $this->aiService->analyze($scraped);

            Response::json([
                'raw_product'   => $scraped,
                'ai_suggestion' => $suggestion,
            ]);
        } catch (\InvalidArgumentException $e) {
            Response::error($e->getMessage(), 422);
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function translate(array $params): void
    {
        $body        = json_decode((string) file_get_contents('php://input'), true) ?? [];
        $title       = trim((string) ($body['title'] ?? ''));
        $description = trim((string) ($body['description'] ?? ''));

        if ($title === '' && $description === '') {
            Response::error('title or description is required.', 422);
            return;
        }

        try {
            $result = $this->aiService->translate($title, $description);
            Response::json($result);
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
