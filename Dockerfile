FROM node:18

LABEL maintainer="bucai<1450941858@qq.com>"

ADD . /app/

WORKDIR /app

RUN rm -rf node_modules cache

# RUN npm config set sharp_binary_host https://npm.taobao.org/mirrors/sharp

# RUN npm config set sharp_libvips_binary_host https://npm.taobao.org/mirrors/sharp-libvips

RUN npm install -f --registry https://registry.npm.taobao.org --max-old-space-size=8192

# RUN npm run build

EXPOSE 3000

CMD  nohup sh -c 'npm run start'