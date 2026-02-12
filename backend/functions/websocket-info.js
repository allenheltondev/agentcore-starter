/**
 * WebSocket Info Function
 *
 * Returns WebSocket connection information for frontend clients.
 * With JWT authentication from browsers, the token should be passed in the URL
 * as a query parameter since browser WebSocket API doesn't support custom headers.
 */

export const handler = async (event) => {
    try {
        console.log('WebSocket info request received');
        console.log('Event headers:', JSON.stringify(event.headers));

        const region = process.env.AWS_REGION;
        const runtimeArn = process.env.AGENT_RUNTIME_ARN;

        if (!runtimeArn) {
            throw new Error('AGENT_RUNTIME_ARN environment variable not set');
        }

        // Extract runtime ID from ARN for reference
        // ARN format: arn:aws:bedrock-agentcore:region:account:runtime/runtime-id
        const runtimeId = runtimeArn.split('/').pop();

        // Construct WebSocket URL with FULL ARN (URL-encoded)
        // AgentCore Runtime expects the full ARN in the path, not just the ID
        const encodedArn = encodeURIComponent(runtimeArn);
        const wsUrl = `wss://bedrock-agentcore.${region}.amazonaws.com/runtimes/${encodedArn}/ws`;

        console.log('Returning WebSocket info:', {
            wsUrl,
            runtimeArn,
            runtimeId,
            authType: 'JWT',
            note: 'Pass JWT token as query parameter: ?authorization=Bearer+{token}'
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,OPTIONS'
            },
            body: JSON.stringify({
                wsUrl,
                runtimeArn,
                runtimeId,
                authType: 'JWT',
                note: 'Browser WebSocket: append token as query parameter - ?authorization=Bearer+{token}'
            })
        };

    } catch (error) {
        console.error('Error getting WebSocket info:', error);

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Internal Server Error',
                message: 'Failed to get WebSocket connection information',
                details: error.message
            })
        };
    }
};
