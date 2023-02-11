FROM node:latest

WORKDIR /home/node

ENV LANG C.UTF-8

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3001

CMD [ "node", "index.js" ]
