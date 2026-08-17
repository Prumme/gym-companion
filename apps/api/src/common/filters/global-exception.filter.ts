import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';

import { AppConfigService } from '../../config/app-config.service';

type ErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    fieldErrors?: Record<string, string[]>;
    requestId: string;
  };
};

function isZodError(exception: unknown): exception is ZodError {
  if (exception instanceof ZodError) {
    return true;
  }
  return (
    typeof exception === 'object' &&
    exception !== null &&
    (exception as { name?: string }).name === 'ZodError' &&
    Array.isArray((exception as { issues?: unknown }).issues)
  );
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly config: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? randomUUID();

    const { status, body } = this.toErrorResponse(exception, requestId);
    const safePath = this.redactSensitivePath(request.url);

    if (status >= 500) {
      this.logger.error({
        requestId,
        path: safePath,
        method: request.method,
        message: exception instanceof Error ? exception.message : 'Unknown error',
      });
    } else {
      this.logger.warn({
        requestId,
        path: safePath,
        method: request.method,
        code: body.error.code,
      });
    }

    response.status(status).json(body);
  }

  /** Ne jamais logger le token bearer d’un lien /share/:token. */
  private redactSensitivePath(url: string): string {
    return url
      .replace(/(\/api\/v1\/shares\/)[^/?#]+/gi, '$1[redacted]')
      .replace(/([?&]token=)[^&]*/gi, '$1[redacted]');
  }

  private toErrorResponse(
    exception: unknown,
    requestId: string,
  ): { status: number; body: ErrorBody } {
    if (isZodError(exception)) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of exception.issues) {
        const key = issue.path.join('.') || 'form';
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
      }

      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Données invalides.',
            fieldErrors,
            requestId,
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return {
          status,
          body: {
            error: {
              code: this.codeFromStatus(status),
              message: this.config.isProduction
                ? this.genericMessage(status)
                : exceptionResponse,
              requestId,
            },
          },
        };
      }

      const payload = exceptionResponse as Record<string, unknown>;
      const message =
        typeof payload.message === 'string'
          ? payload.message
          : Array.isArray(payload.message)
            ? 'Validation failed'
            : this.genericMessage(status);

      const fieldErrors =
        Array.isArray(payload.message) &&
        payload.message.every((item) => typeof item === 'string')
          ? { form: payload.message as string[] }
          : undefined;

      return {
        status,
        body: {
          error: {
            code:
              typeof payload.code === 'string'
                ? payload.code
                : this.codeFromStatus(status),
            message:
              this.config.isProduction && status >= 500
                ? this.genericMessage(status)
                : message,
            details: payload.details,
            fieldErrors:
              (payload.fieldErrors as Record<string, string[]> | undefined) ??
              fieldErrors,
            requestId,
          },
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: this.genericMessage(HttpStatus.INTERNAL_SERVER_ERROR),
          requestId,
        },
      },
    };
  }

  private codeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      default:
        return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'HTTP_ERROR';
    }
  }

  private genericMessage(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Requête invalide.';
      case HttpStatus.UNAUTHORIZED:
        return 'Authentification requise.';
      case HttpStatus.FORBIDDEN:
        return 'Accès interdit.';
      case HttpStatus.NOT_FOUND:
        return 'Ressource introuvable.';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'Service temporairement indisponible.';
      default:
        return 'Une erreur interne est survenue.';
    }
  }
}
