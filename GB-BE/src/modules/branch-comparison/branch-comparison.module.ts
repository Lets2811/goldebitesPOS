import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { BranchComparisonController } from './branch-comparison.controller';
import { BranchComparisonRepository } from './branch-comparison.repository';
import { BranchComparisonService } from './branch-comparison.service';

/** Every branch of the business side by side, for who may work at all of them. */
@Module({
  imports: [BusinessesModule],
  controllers: [BranchComparisonController],
  providers: [BranchComparisonService, BranchComparisonRepository],
  exports: [BranchComparisonService],
})
export class BranchComparisonModule {}
