import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserEventSyncs1749523000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`user_event_syncs\` (
        \`id\`            varchar(36)   NOT NULL,
        \`userId\`        varchar(36)   NOT NULL,
        \`eventId\`       varchar(36)   NOT NULL,
        \`googleEventId\` varchar(255)  NULL,
        \`syncedAt\`      datetime(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`IDX_user_event_syncs_userId_eventId\` (\`userId\`, \`eventId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`user_event_syncs\``);
  }
}
