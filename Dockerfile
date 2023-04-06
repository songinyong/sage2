FROM    ubuntu:18.04
MAINTAINER	EVL avatar <evl.avatar@gmail.com>
RUN     apt-get update && apt-get install -y \
		software-properties-common build-essential \
		git \
		curl \
		bzip2
RUN     curl -sL https://deb.nodesource.com/setup_12.x | bash -
RUN     apt-get update && apt-get install -y \
		ffmpeg \
		libavcodec-dev libavutil-dev libswresample-dev \
		libavformat-dev libswscale-dev \
		ghostscript \
		libnss3-tools \
		libimage-exiftool-perl \
		webp imagemagick \
		nodejs
RUN     env DEBIAN_FRONTEND=noninteractive apt-get install -y tzdata && rm -rf /var/lib/apt/lists/*

COPY    package.json /tmp/package.json
RUN     cd /tmp; npm install --production
RUN     mkdir -p /sage2; cp -a /tmp/node_modules /sage2/

# Set this environment variable to true to set timezone on container start.
ENV SET_CONTAINER_TIMEZONE true
# Default container timezone as found under the directory /usr/share/zoneinfo/.
ENV CONTAINER_TIMEZONE America/Chicago

COPY    . /sage2

RUN     /sage2/bin/docker_set_timezone.sh
RUN	/bin/rm -f /etc/ImageMagick-6/policy.xml

EXPOSE  9090
EXPOSE  9292
WORKDIR /sage2
CMD ["nodejs", "/sage2/server.js", "-f", "/sage2/config/docker-cfg.json", "-i"]

