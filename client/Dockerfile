FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

# The lockfile was resolved with --legacy-peer-deps (rich-text-editor pins React 18
# while the app is on React 19); plain `npm ci` refuses that tree.
RUN npm ci --legacy-peer-deps

COPY . .

EXPOSE 5174

CMD ["npm", "run", "dev"]
