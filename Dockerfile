FROM node:20-slim
WORKDIR /app
RUN npm config set ignore-scripts false
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
