FROM chrislusf/seaweedfs:latest

EXPOSE 8333
EXPOSE 9333

# Override these in CapRover app env.
ENV AWS_ACCESS_KEY_ID=seaweedfs
ENV AWS_SECRET_ACCESS_KEY=change-me

# Single-node SeaweedFS with S3 gateway enabled.
ENTRYPOINT ["weed"]
CMD ["server", "-dir=/data", "-s3", "-s3.port=8333"]
