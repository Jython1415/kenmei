// backend/routes/api.js
import express from 'express';
import { anthropicHandler, perplexityHandler, batchPerplexityHandler, setupSSE } from '../controllers/apiController.js';
import { validateApiRequest } from '../middleware/validation.js';

const router = express.Router();

router.post('/anthropic', validateApiRequest, anthropicHandler);
router.post('/perplexity', validateApiRequest, perplexityHandler);
router.get('/perplexity/stream', setupSSE);
router.post('/perplexity/batch', batchPerplexityHandler);

export { router };
