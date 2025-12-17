# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the Angular application
RUN npm run build

# Stage 2: Serve the application
FROM node:20-alpine

WORKDIR /app

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist
# We need package.json for potentially looking up versions or scripts, though strictly the built server might not need it if it bundles everything.
# However, copying it is often good practice or required if the server relies on it.
COPY --from=builder /app/package.json ./

# Expose the port the app runs on
EXPOSE 4000

# Command to run the application
# Based on package.json: "serve:ssr:my-ai-chatapp": "node dist/my-ai-chatapp/server/server.mjs"
CMD ["node", "dist/my-ai-chatapp/server/server.mjs"]
