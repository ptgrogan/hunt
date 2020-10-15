FROM node:alpine
WORKDIR /usr/app
COPY . .
RUN npm install --production --unsafe-perm
ENV PORT=3000
EXPOSE $PORT
CMD [ "npm", "start" ]
