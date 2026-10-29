import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSeasonRequestEpisodeSelection1785400000000 implements MigrationInterface {
  name = 'AddSeasonRequestEpisodeSelection1785400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "season_request" ADD COLUMN "selectedEpisodes" text`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "season_request" DROP COLUMN "selectedEpisodes"`
    );
  }
}
