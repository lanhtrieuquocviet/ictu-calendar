import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCancelAndHiddenToEvents1749524000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`events\`
        ADD COLUMN IF NOT EXISTS \`isHidden\`        tinyint(1)   NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS \`lastNotifiedAt\`  datetime(6)  NULL,
        ADD COLUMN IF NOT EXISTS \`cancelledByName\` varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS \`cancelledAt\`     datetime(6)  NULL,
        ADD COLUMN IF NOT EXISTS \`cancelReason\`    text         NULL,
        ADD COLUMN IF NOT EXISTS \`googleEventId\`   varchar(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`events\`
        DROP COLUMN IF EXISTS \`isHidden\`,
        DROP COLUMN IF EXISTS \`lastNotifiedAt\`,
        DROP COLUMN IF EXISTS \`cancelledByName\`,
        DROP COLUMN IF EXISTS \`cancelledAt\`,
        DROP COLUMN IF EXISTS \`cancelReason\`,
        DROP COLUMN IF EXISTS \`googleEventId\`
    `);
  }
}
