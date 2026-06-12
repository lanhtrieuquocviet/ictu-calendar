import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFkToUserEventSyncs1749525000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Điều chỉnh collation của userId để khớp với users.id
    const [userColInfo] = await queryRunner.query(`
      SELECT CHARACTER_SET_NAME, COLLATION_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'id'
    `);
    if (userColInfo) {
      await queryRunner.query(
        `ALTER TABLE \`user_event_syncs\`
          MODIFY COLUMN \`userId\` varchar(36)
            CHARACTER SET ${userColInfo.CHARACTER_SET_NAME}
            COLLATE ${userColInfo.COLLATION_NAME} NOT NULL`,
      );
    }

    // Điều chỉnh collation của eventId để khớp với events.id
    const [eventColInfo] = await queryRunner.query(`
      SELECT CHARACTER_SET_NAME, COLLATION_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'events'
        AND COLUMN_NAME = 'id'
    `);
    if (eventColInfo) {
      await queryRunner.query(
        `ALTER TABLE \`user_event_syncs\`
          MODIFY COLUMN \`eventId\` varchar(36)
            CHARACTER SET ${eventColInfo.CHARACTER_SET_NAME}
            COLLATE ${eventColInfo.COLLATION_NAME} NOT NULL`,
      );
    }

    // Xóa dữ liệu rác trước khi thêm FK
    await queryRunner.query(`
      DELETE FROM \`user_event_syncs\`
      WHERE \`userId\` NOT IN (SELECT \`id\` FROM \`users\`)
         OR \`eventId\` NOT IN (SELECT \`id\` FROM \`events\`)
    `);

    // FK đến users
    const [fkUser] = await queryRunner.query(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'user_event_syncs'
        AND CONSTRAINT_NAME = 'FK_user_event_syncs_userId'
    `);
    if (!fkUser) {
      await queryRunner.query(`
        ALTER TABLE \`user_event_syncs\`
          ADD CONSTRAINT \`FK_user_event_syncs_userId\`
            FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      `);
    }

    // FK đến events
    const [fkEvent] = await queryRunner.query(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'user_event_syncs'
        AND CONSTRAINT_NAME = 'FK_user_event_syncs_eventId'
    `);
    if (!fkEvent) {
      await queryRunner.query(`
        ALTER TABLE \`user_event_syncs\`
          ADD CONSTRAINT \`FK_user_event_syncs_eventId\`
            FOREIGN KEY (\`eventId\`) REFERENCES \`events\`(\`id\`) ON DELETE CASCADE
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`user_event_syncs\`
        DROP FOREIGN KEY IF EXISTS \`FK_user_event_syncs_eventId\`,
        DROP FOREIGN KEY IF EXISTS \`FK_user_event_syncs_userId\`
    `);
  }
}
