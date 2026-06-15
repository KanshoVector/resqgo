FROM node:20-slim
WORKDIR /app
# 依存関係のインストールを許可する設定
RUN npm config set ignore-scripts false