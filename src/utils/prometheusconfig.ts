import { NextFunction, Request, Response } from 'express';
import { Histogram, register } from 'prom-client';

// Create a registry and metrics
const httpRequestDurationMicroseconds = new Histogram({
  name: 'http_request_duration_microseconds',
  help: 'Duration of HTTP requests in microseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 5, 15, 50, 100, 500, 1000, 2000, 5000],
});

// Register metrics
register.registerMetric(httpRequestDurationMicroseconds);

// Middleware to serve Prometheus metrics
export const prometheusMetrics = async (req: Request, res: Response, next: NextFunction) => {
  if (req.url === '/metrics') {
    res.setHeader('Content-Type', register.contentType);
    return res.send(await register.metrics());
  }
  next();
};

// Middleware to track request duration
export const trackRequestDuration = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime();

  res.on('finish', () => {
    const elapsedTime = process.hrtime(startTime);
    const durationInMicroseconds = (elapsedTime[0] * 1e9 + elapsedTime[1]) / 1e3;
    const labels = {
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode.toString(),
    };
    httpRequestDurationMicroseconds.observe(labels, durationInMicroseconds);
  });

  next();
};
