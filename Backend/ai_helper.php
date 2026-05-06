<?php
/**
 * AI Service Helper Class
 * 
 * Provides methods to communicate with the FastAPI AIService.
 */
class AIServiceHelper {
    private $baseUrl;

    public function __construct($baseUrl = "http://localhost:8000") {
        $this->baseUrl = $baseUrl;
    }

    /**
     * Sync a product to the AI service for semantic search indexing.
     */
    public function indexProduct($productData) {
        return $this->postRequest("/search/index-product", $productData);
    }

    /**
     * Perform a semantic search.
     */
    public function semanticSearch($query, $limit = 5) {
        return $this->postRequest("/search/semantic", [
            "query" => $query,
            "limit" => $limit
        ]);
    }

    /**
     * Get a response from the AI Assistant.
     */
    public function askAssistant($messages) {
        return $this->postRequest("/chat/assistant", [
            "messages" => $messages
        ]);
    }

    private function postRequest($endpoint, $data) {
        $url = $this->baseUrl . $endpoint;
        $ch = curl_init($url);
        
        $jsonData = json_encode($data);
        
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonData);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($jsonData)
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        if (curl_errno($ch)) {
            $error = curl_error($ch);
            curl_close($ch);
            return ["error" => $error];
        }
        
        curl_close($ch);
        
        if ($httpCode >= 400) {
            return ["error" => "HTTP $httpCode", "details" => $response];
        }
        
        return json_decode($response, true);
    }
}
?>
