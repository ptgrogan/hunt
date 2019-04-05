FROM node:alpine
WORKDIR /usr/app
COPY . .
RUN npm install --production --unsafe-perm
EXPOSE 80
CMD [ "npm", "start" ]
