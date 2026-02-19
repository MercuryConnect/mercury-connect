CREATE TABLE `recordings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`sessionStringId` varchar(32) NOT NULL,
	`recordedBy` int NOT NULL,
	`fileKey` text NOT NULL,
	`url` text NOT NULL,
	`fileSize` bigint,
	`durationSeconds` int,
	`mimeType` varchar(64) DEFAULT 'video/webm',
	`clientName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recordings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessionLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`activityType` enum('session_created','client_joined','host_connected','control_started','control_ended','clipboard_sync','disconnected','reconnected','session_ended','client_disconnected') NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessionLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(32) NOT NULL,
	`passwordHash` varchar(128) NOT NULL,
	`status` enum('waiting','connecting','connected','disconnected','expired') NOT NULL DEFAULT 'waiting',
	`hostUserId` int,
	`clientName` varchar(255),
	`clientIp` varchar(45),
	`hostOffer` text,
	`clientAnswer` text,
	`clientOffer` text,
	`hostAnswer` text,
	`hostIceCandidates` text,
	`clientIceCandidates` text,
	`startNotificationSent` boolean DEFAULT false,
	`endNotificationSent` boolean DEFAULT false,
	`calendarEventId` varchar(255),
	`calendarSource` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`connectedAt` timestamp,
	`endedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `recordings` ADD CONSTRAINT `recordings_sessionId_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recordings` ADD CONSTRAINT `recordings_recordedBy_users_id_fk` FOREIGN KEY (`recordedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessionLogs` ADD CONSTRAINT `sessionLogs_sessionId_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_hostUserId_users_id_fk` FOREIGN KEY (`hostUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;