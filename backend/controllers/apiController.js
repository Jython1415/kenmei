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
