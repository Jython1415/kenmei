export const validateApiRequest = (req, res, next) => {
    if (!req.body) {
        return res.status(400).json({ error: 'Request body is required' });
    }

    // Add any specific validation for your API requests here
    // For example, checking required fields, data types, etc.

    next();
};
