import { pgTable, serial, timestamp, varchar, boolean, integer, text, jsonb, index } from "drizzle-orm/pg-core"

// 系统健康检查表（必须保留）
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 网盘账号表
export const cloudDrives = pgTable(
	"cloud_drives",
	{
		id: serial().primaryKey(),
		name: varchar("name", { length: 50 }).notNull(), // 115/aliyun/quark 等
		alias: varchar("alias", { length: 100 }), // 用户自定义别名
		config: jsonb("config"), // 配置信息（账号、cookie等敏感信息）
		is_active: boolean("is_active").default(true).notNull(),
		connection_status: varchar("connection_status", { length: 20 }).default("unknown"), // online/offline/unknown
		last_check_at: timestamp("last_check_at", { withTimezone: true }), // 最后检查时间
		last_error: varchar("last_error", { length: 500 }), // 最后错误信息
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [index("cloud_drives_name_idx").on(table.name)]
);

// 文件监控任务表
export const fileMonitors = pgTable(
	"file_monitors",
	{
		id: serial().primaryKey(),
		cloud_drive_id: integer("cloud_drive_id").notNull().references(() => cloudDrives.id, { onDelete: "cascade" }),
		path: varchar("path", { length: 500 }).notNull(), // 监控路径（115网盘为数字ID）
		path_name: varchar("path_name", { length: 500 }), // 监控路径名称（用于显示）
		full_path: varchar("full_path", { length: 1000 }), // 完整可读路径（如 /媒体库/外语电影）
		enabled: boolean("enabled").default(true).notNull(),
		cron_expression: varchar("cron_expression", { length: 100 }).default("*/10 7-23 * * *"), // cron表达式，默认07:00-23:59每10分钟
		push_channel_ids: jsonb("push_channel_ids"), // 推送渠道ID数组
		push_template_type: varchar("push_template_type", { length: 20 }).default("tv"), // 推送模板类型
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), // 用于判断新文件的时间界限
	},
	(table) => [
		index("file_monitors_cloud_drive_id_idx").on(table.cloud_drive_id),
		index("file_monitors_enabled_idx").on(table.enabled),
	]
);

// 分享记录表
export const shareRecords = pgTable(
	"share_records",
	{
		id: serial().primaryKey(),
		cloud_drive_id: integer("cloud_drive_id").references(() => cloudDrives.id), // 智能助手推送时可能为null
		monitor_id: integer("monitor_id").references(() => fileMonitors.id), // 关联的监控任务
		file_path: varchar("file_path", { length: 1000 }).notNull(),
		file_name: varchar("file_name", { length: 500 }).notNull(),
		file_size: varchar("file_size", { length: 50 }), // 文件大小
		file_type: varchar("file_type", { length: 50 }), // 文件类型
		content_type: varchar("content_type", { length: 50 }), // 内容类型 (movie/tv/unknown)
		share_url: varchar("share_url", { length: 1000 }),
		share_code: varchar("share_code", { length: 50 }), // 提取码
		share_status: varchar("share_status", { length: 20 }).default("pending").notNull(), // pending/success/failed/cancelled
		source: varchar("source", { length: 20 }).default("manual").notNull(), // manual/monitor/assistant
		error_message: text("error_message"), // 错误信息
		expire_at: timestamp("expire_at", { withTimezone: true }), // 过期时间
		access_count: integer("access_count").default(0), // 访问次数
		remark: text("remark"), // 备注
		tags: text("tags").array(), // 标签
		tmdb_id: integer("tmdb_id"), // TMDB ID
		tmdb_title: varchar("tmdb_title", { length: 500 }), // TMDB 标题
		tmdb_info: jsonb("tmdb_info"), // TMDB 完整信息
		is_completed: boolean("is_completed").default(false), // 是否完结
		file_count: integer("file_count"), // 文件数量（打包分享时）
		cancelled_reason: varchar("cancelled_reason", { length: 200 }), // 取消原因
		file_created_at: timestamp("file_created_at", { withTimezone: true }), // 文件创建时间
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("share_records_cloud_drive_id_idx").on(table.cloud_drive_id),
		index("share_records_monitor_id_idx").on(table.monitor_id),
		index("share_records_status_idx").on(table.share_status),
		index("share_records_source_idx").on(table.source),
		index("share_records_created_at_idx").on(table.created_at),
	]
);

// 推送分组表
export const pushGroups = pgTable(
	"push_groups",
	{
		id: serial().primaryKey(),
		group_name: varchar("group_name", { length: 100 }).notNull(),
		channel_type: varchar("channel_type", { length: 20 }).notNull(), // telegram/qq/wechat/dingtalk等
		sort_order: integer("sort_order").default(0),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("push_groups_type_idx").on(table.channel_type),
	]
);

// 推送渠道表
export const pushChannels = pgTable(
	"push_channels",
	{
		id: serial().primaryKey(),
		cloud_drive_id: integer("cloud_drive_id").references(() => cloudDrives.id), // 可为空，不再强制绑定网盘
		group_id: integer("group_id").references(() => pushGroups.id, { onDelete: "set null" }), // 分组ID
		channel_type: varchar("channel_type", { length: 20 }).notNull(), // telegram/qq/wechat/dingtalk/feishu/bark/serverchan
		channel_name: varchar("channel_name", { length: 100 }).notNull(),
		config: jsonb("config"), // 渠道配置（token、chat_id、webhook_url等）
		is_active: boolean("is_active").default(true).notNull(),
		sort_order: integer("sort_order").default(0), // 排序
		success_count: integer("success_count").default(0), // 成功次数
		fail_count: integer("fail_count").default(0), // 失败次数
		last_push_at: timestamp("last_push_at", { withTimezone: true }), // 最后推送时间
		last_push_status: varchar("last_push_status", { length: 20 }), // 最后推送状态
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("push_channels_cloud_drive_id_idx").on(table.cloud_drive_id),
		index("push_channels_type_idx").on(table.channel_type),
		index("push_channels_group_idx").on(table.group_id),
	]
);

// 推送规则表
export const pushRules = pgTable(
	"push_rules",
	{
		id: serial().primaryKey(),
		cloud_drive_id: integer("cloud_drive_id").notNull().references(() => cloudDrives.id),
		name: varchar("name", { length: 100 }).notNull(),
		content_type: varchar("content_type", { length: 20 }).notNull(), // tv/movie/all
		keyword_filter: text("keyword_filter"), // 关键词过滤（JSON数组）
		only_completed: boolean("only_completed").default(false), // 仅完结时推送
		min_size: integer("min_size"), // 最小文件大小（字节）
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("push_rules_cloud_drive_id_idx").on(table.cloud_drive_id),
		index("push_rules_content_type_idx").on(table.content_type),
	]
);

// 推送模板表
export const pushTemplates = pgTable(
	"push_templates",
	{
		id: serial().primaryKey(),
		cloud_drive_id: integer("cloud_drive_id").references(() => cloudDrives.id), // null 表示所有网盘
		name: varchar("name", { length: 100 }).notNull(),
		channel_type: varchar("channel_type", { length: 20 }).notNull(), // telegram/qq/wechat
		content_type: varchar("content_type", { length: 20 }).notNull(), // tv_series/movie/completed
		template_content: text("template_content").notNull(), // 模板内容
		include_image: boolean("include_image").default(true), // 是否包含图片
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("push_templates_cloud_drive_id_idx").on(table.cloud_drive_id),
		index("push_templates_channel_type_idx").on(table.channel_type),
		index("push_templates_content_type_idx").on(table.content_type),
	]
);

// 推送记录表
export const pushRecords = pgTable(
	"push_records",
	{
		id: serial().primaryKey(),
		share_record_id: integer("share_record_id").notNull().references(() => shareRecords.id),
		push_channel_id: integer("push_channel_id").notNull().references(() => pushChannels.id),
		push_rule_id: integer("push_rule_id").references(() => pushRules.id),
		push_template_id: integer("push_template_id").references(() => pushTemplates.id),
		content: text("content"), // 推送内容
		push_status: varchar("push_status", { length: 20 }).default("pending").notNull(), // pending/success/failed/retrying
		error_message: text("error_message"), // 错误信息
		retry_count: integer("retry_count").default(0), // 重试次数
		pushed_at: timestamp("pushed_at", { withTimezone: true }), // 推送时间
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("push_records_share_record_id_idx").on(table.share_record_id),
		index("push_records_push_channel_id_idx").on(table.push_channel_id),
		index("push_records_status_idx").on(table.push_status),
	]
);

// 系统设置表
export const systemSettings = pgTable(
	"system_settings",
	{
		id: serial().primaryKey(),
		setting_key: varchar("setting_key", { length: 100 }).notNull().unique(),
		setting_value: jsonb("setting_value"), // 设置值（JSON格式）
		description: text("description"), // 设置说明
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [index("system_settings_key_idx").on(table.setting_key)]
);

// 操作日志表
export const operationLogs = pgTable(
	"operation_logs",
	{
		id: serial().primaryKey(),
		cloud_drive_id: integer("cloud_drive_id").references(() => cloudDrives.id),
		operation_type: varchar("operation_type", { length: 50 }).notNull(), // share/push/monitor
		operation_detail: text("operation_detail"), // 操作详情
		status: varchar("status", { length: 20 }).notNull(), // success/failed
		error_message: text("error_message"), // 错误信息
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("operation_logs_cloud_drive_id_idx").on(table.cloud_drive_id),
		index("operation_logs_type_idx").on(table.operation_type),
		index("operation_logs_created_at_idx").on(table.created_at),
	]
);
