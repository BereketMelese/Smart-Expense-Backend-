import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("authenticate", async function authenticate(request, reply) {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({
        message: "Unauthorized",
        code: "UNAUTHORIZED"
      });
    }
  });
};

export default fp(authPlugin);
