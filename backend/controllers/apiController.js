// backend/controllers/apiController.js
import fetch from 'node-fetch';

export const anthropicHandler = async (req, res) => {
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'anthropic-version': '2023-06-01',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(`Anthropic API error: ${response.status} - ${JSON.stringify(data)}`);
        }

        res.json(data);
    } catch (error) {
        console.error('Anthropic API error:', error);
        res.status(500).json({ error: error.message });
    }
};

const sseClients = new Map();

export const setupSSE = (req, res) => {
    const sessionId = req.query.sessionId;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' });
    }

    // Essential headers for SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no' // Disable nginx buffering if using nginx
    });

    // Ensure the connection stays alive
    res.flushHeaders();
    res.write('\n');

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Keep connection alive
    const keepAlive = setInterval(() => {
        if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ type: 'keep-alive' })}\n\n`);
        }
    }, 30000);

    // Store the client connection
    sseClients.set(sessionId, { 
        res,
        keepAlive,
        connectedAt: new Date()
    });

    // Handle client disconnect
    req.on('close', () => {
        clearInterval(keepAlive);
        sseClients.delete(sessionId);
        console.log(`SSE client disconnected: ${sessionId}`);
    });

    // Handle server-side errors
    res.on('error', (error) => {
        console.error(`SSE Response error for ${sessionId}:`, error);
        clearInterval(keepAlive);
        sseClients.delete(sessionId);
    });
};

class QueueLogger {
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.lastRequestTime = null;
    }

    log(event, details = {}) {
        const now = new Date();
        const timestamp = now.toISOString();
        let timeSinceLastRequest = '';

        if (this.lastRequestTime && event === 'request') {
            const diff = now - this.lastRequestTime;
            timeSinceLastRequest = `(${diff}ms since last request)`;
            this.lastRequestTime = now;
        } else if (event === 'request') {
            this.lastRequestTime = now;
        }

        const logEntry = {
            timestamp,
            sessionId: this.sessionId,
            event,
            ...details,
            ...(timeSinceLastRequest && { timeSinceLastRequest })
        };

        console.log(JSON.stringify(logEntry));
    }
}

class QueryQueue {
    constructor(sessionId) {
        this.queue = [];
        this.inProgress = new Set();
        this.results = new Map();
        this.maxRetries = 3;
        this.baseDelay = 1000; // 1 second
        this.logger = new QueueLogger(sessionId);
    }

    async processQueue(sessionId) {
        this.logger.log('queue_start', { queueSize: this.queue.length });

        while (this.queue.length > 0) {
            const queryTask = this.queue[0];
            
            if (this.inProgress.has(queryTask.id)) {
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
            }

            this.queue.shift();
            this.inProgress.add(queryTask.id);

            this.logger.log('process_task', {
                taskId: queryTask.id,
                query: queryTask.query,
                retryCount: queryTask.retries,
                remainingQueue: this.queue.length
            });

            try {
                const result = await this.executeQueryWithBackoff(queryTask);
                this.results.set(queryTask.id, result);
                this.inProgress.delete(queryTask.id);
                
                this.logger.log('task_success', {
                    taskId: queryTask.id,
                    retryCount: queryTask.retries
                });
                
                const progress = {
                    completed: this.results.size,
                    total: this.results.size + this.queue.length,
                    lastCompleted: queryTask.query
                };
                this.emit(sessionId, progress);
            } catch (error) {
                this.logger.log('task_error', {
                    taskId: queryTask.id,
                    retryCount: queryTask.retries,
                    error: error.message
                });

                this.inProgress.delete(queryTask.id);
                
                if (queryTask.retries < this.maxRetries) {
                    queryTask.retries++;
                    this.queue.unshift(queryTask);

                    this.logger.log('task_retry', {
                        taskId: queryTask.id,
                        newRetryCount: queryTask.retries,
                        maxRetries: this.maxRetries
                    });
                } else {
                    this.results.set(queryTask.id, { error: error.message });
                    this.logger.log('task_max_retries', {
                        taskId: queryTaskid,
                        error: error.message
                    });
                }
            }
        }

        this.logger.log('queue_complete', {
            totalProcessed: this.results.size,
            successCount: Array.from(this.results.values()).filter(r => !r.error).length,
            errorCount: Array.from(this.results.values()).filter(r => r.error).length
        });

        return Array.from(this.results.values());
    }

    async executeQueryWithBackoff(queryTask) {
        const delay = this.baseDelay * Math.pow(2, queryTask.retries);
        await new Promise(resolve => setTimeout(resolve, delay));

        this.logger.log('request', {
            taskId: queryTask.id,
            query: queryTask.query,
            delay
        });

        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(queryTask.body)
        });

        if (!response.ok) {
            throw new Error(`Perplexity API error: ${response.status}`);
        }

        return await response.json();
    }

    addQuery(query, body) {
        this.queue.push({
            id: Math.random().toString(36).substr(2, 9),
            query,
            body,
            retries: 0
        });
    }

    emit(sessionId, data) {
        const client = sseClients.get(sessionId);
        if (client?.res) {
            try {
                const sseData = `data: ${JSON.stringify(data)}\n\n`;
                client.res.write(sseData);

                this.logger.log('sse_emit', {
                    sessionId,
                    eventData: data
                });
            } catch (error) {
                this.logger.log('sse_error', {
                    sessionId,
                    error: error.message
                });

                if (client.keepAlive) {
                    clearInterval(client.keepAlive);
                }
                sseClients.delete(sessionId);
            }
        }
    }
}

// Maintain active queues by session
const activeQueues = new Map();

export const batchPerplexityHandler = async (req, res) => {
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' });
    }

    // Handle SSE connection request
    if (req.headers.accept === 'text/event-stream') {
        return setupSSE(req, res);
    }

    // Handle batch processing request
    const queue = new QueryQueue(sessionId);
    activeQueues.set(sessionId, queue);

    // Add queries to queue
    const { queries } = req.body;
    queries.forEach(({ query, body }) => queue.addQuery(query, body));

    try {
        const results = await queue.processQueue(sessionId);
        
        // Clean up
        activeQueues.delete(sessionId);
        sseClients.delete(sessionId);
        
        res.json({ results });
    } catch (error) {
        // Clean up on error
        activeQueues.delete(sessionId);
        sseClients.delete(sessionId);
        
        res.status(500).json({ error: error.message });
    }
};

export const perplexityHandler = async (req, res) => {
    try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(`Perplexity API error: ${response.status} - ${JSON.stringify(data)}`);
        }

        res.json(data);
    } catch (error) {
        console.error('Perplexity API error:', error);
        res.status(500).json({ error: error.message });
    }
};
