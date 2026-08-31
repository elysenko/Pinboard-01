import { Global, Module } from '@nestjs/common';
import { ConfigResolver } from './config';

/** Makes ConfigResolver injectable anywhere without repeating the import. */
@Global()
@Module({
  providers: [ConfigResolver],
  exports: [ConfigResolver],
})
export class ConfigResolverModule {}
