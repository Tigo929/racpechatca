import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const PRICE_FIELDS = ['totalOrder', 'deliveryCost', 'price', 'pricePosition', 'designCost'];

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (PRICE_FIELDS.includes(key)) continue;
      result[key] = strip(obj[key]);
    }
    return result;
  }
  return value;
}

@Injectable()
export class StripPricesInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const role = req.user?.role;
    if (role !== 'EXECUTOR') return next.handle();
    return next.handle().pipe(map((data) => strip(data)));
  }
}
