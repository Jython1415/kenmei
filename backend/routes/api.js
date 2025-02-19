import express from 'express';
import { anthropicHandler, perplexityHandler } from '../controllers/apiController.js';
import { validateApiRequest } from '../middleware/validation.js';

const router = express.Router();

router.post('/anthropic', validateApiRequest, anthropicHandler);
router.post('/perplexity', validateApiRequest, perplexityHandler);

export { router };
