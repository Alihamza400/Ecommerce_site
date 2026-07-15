<?php
/**
 * Enterprise Cache Layer — Redis with file fallback
 * 
 * Usage:
 *   require_once 'cache.php';
 *   $cache = new AppCache();
 *   $products = $cache->remember('products.all', 300, function() {
 *       global $con;
 *       return $con->query("SELECT * FROM products")->fetch_all(MYSQLI_ASSOC);
 *   });
 */

class AppCache {
    private $redis = null;
    private $useRedis = false;
    private $fallbackDir = '';

    public function __construct() {
        $this->fallbackDir = __DIR__ . '/cache/';
        if (!is_dir($this->fallbackDir)) {
            @mkdir($this->fallbackDir, 0777, true);
        }
        // Attempt to connect to Redis
        try {
            require_once __DIR__ . '/vendor/predis/src/Autoloader.php';
            Predis\Autoloader::register();
            $this->redis = new Predis\Client([
                'scheme' => 'tcp',
                'host'   => '127.0.0.1',
                'port'   => 6379,
                'timeout' => 1.0,
                'read_write_timeout' => 1.0,
            ]);
            $this->redis->ping();
            $this->useRedis = true;
        } catch (Exception $e) {
            $this->useRedis = false;
        }
    }

    /**
     * Get or set cache.
     */
    public function remember(string $key, int $ttl, callable $callback) {
        $key = 'shopverse:' . $key;

        // Try Redis first
        if ($this->useRedis) {
            try {
                $cached = $this->redis->get($key);
                if ($cached !== null) {
                    return json_decode($cached, true);
                }
            } catch (Exception $e) {
                $this->useRedis = false;
            }
        }

        // Try file fallback
        $file = $this->fallbackDir . md5($key) . '.cache';
        if (file_exists($file) && (time() - filemtime($file)) < $ttl) {
            $data = file_get_contents($file);
            if ($data !== false) {
                return json_decode($data, true);
            }
        }

        // Execute callback
        $data = $callback();

        // Store in Redis
        if ($this->useRedis) {
            try {
                $this->redis->setex($key, $ttl, json_encode($data));
            } catch (Exception $e) {}
        }

        // Store file fallback
        @file_put_contents($file, json_encode($data));

        return $data;
    }

    /**
     * Invalidate a cache key / pattern.
     */
    public function forget(string $key) {
        $key = 'shopverse:' . $key;
        if ($this->useRedis) {
            try { $this->redis->del($key); } catch (Exception $e) {}
        }
        $file = $this->fallbackDir . md5($key) . '.cache';
        if (file_exists($file)) @unlink($file);
    }

    /**
     * Flush all cache.
     */
    public function flush() {
        if ($this->useRedis) {
            try {
                $keys = $this->redis->keys('shopverse:*');
                foreach ($keys as $k) $this->redis->del($k);
            } catch (Exception $e) {}
        }
        array_map('unlink', glob($this->fallbackDir . '*.cache'));
    }

    public function isRedisConnected(): bool {
        return $this->useRedis;
    }
}
