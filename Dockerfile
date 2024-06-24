# Use the official Node.js image.
FROM node:20

# Create and change to the app directory.
WORKDIR /usr/src/app

COPY . .

# Install production dependencies.
RUN npm install

# Run the web service on container startup.
CMD [ "npm", "run", "start" ]
