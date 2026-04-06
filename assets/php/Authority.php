<?php
/**
 * Helper class for checking user authority flags.
 * Authority is stored as a MySQL SET column with comma-separated values.
 */
class Authority {

	/**
	 * All available authority flags.
	 */
	public const FLAGS = [
		"None", "DbSelect", "DbInsert", "DbAlter",
		"ClientViewPublic", "ClientViewUnlisted", "ClientViewPrivate", "ClientViewOwn",
		"ClientModifyPublic", "ClientModifyUnlisted", "ClientModifyPrivate", "ClientModifyOwn",
		"ServerViewPublic", "ServerViewUnlisted", "ServerViewPrivate"
	];

	/**
	 * Default flags for new users.
	 */
	public const DEFAULT_FLAGS = "ClientViewPublic,ClientViewOwn,ClientModifyOwn,ServerViewPublic";

	/**
	 * Checks if the user has a specific authority flag.
	 * @param string $userAuthority The user's authority SET value.
	 * @param string $requiredFlag The flag to check for.
	 * @return bool
	 */
	public static function hasFlag(string $userAuthority, string $requiredFlag): bool {
		$flags = explode(",", $userAuthority);
		return in_array($requiredFlag, $flags, true);
	}

	/**
	 * Checks if the user has any of the given flags.
	 * @param string $userAuthority The user's authority SET value.
	 * @param array $flagArray Array of flags to check.
	 * @return bool
	 */
	public static function hasAnyFlag(string $userAuthority, array $flagArray): bool {
		$flags = explode(",", $userAuthority);
		foreach ($flagArray as $flag) {
			if (in_array($flag, $flags, true)) return true;
		}
		return false;
	}

	/**
	 * Checks if the user has all of the given flags.
	 * @param string $userAuthority The user's authority SET value.
	 * @param array $flagArray Array of flags to check.
	 * @return bool
	 */
	public static function hasAllFlags(string $userAuthority, array $flagArray): bool {
		$flags = explode(",", $userAuthority);
		foreach ($flagArray as $flag) {
			if (!in_array($flag, $flags, true)) return false;
		}
		return true;
	}

	/**
	 * Checks if the user can view content of the given visibility level.
	 * @param string $userAuthority The user's authority.
	 * @param string $visibility One of: public, unlisted, private.
	 * @param bool $isOwner Whether the user owns the content.
	 * @return bool
	 */
	public static function canView(string $userAuthority, string $visibility, bool $isOwner = false): bool {
		if ($isOwner && self::hasFlag($userAuthority, "ClientViewOwn")) return true;
		return match ($visibility) {
			"public" => self::hasFlag($userAuthority, "ClientViewPublic"),
			"unlisted" => self::hasFlag($userAuthority, "ClientViewUnlisted"),
			"private" => self::hasFlag($userAuthority, "ClientViewPrivate"),
			default => false,
		};
	}

	/**
	 * Checks if the user can modify content of the given visibility level.
	 * @param string $userAuthority The user's authority.
	 * @param string $visibility One of: public, unlisted, private.
	 * @param bool $isOwner Whether the user owns the content.
	 * @return bool
	 */
	public static function canModify(string $userAuthority, string $visibility, bool $isOwner = false): bool {
		if ($isOwner && self::hasFlag($userAuthority, "ClientModifyOwn")) return true;
		return match ($visibility) {
			"public" => self::hasFlag($userAuthority, "ClientModifyPublic"),
			"unlisted" => self::hasFlag($userAuthority, "ClientModifyUnlisted"),
			"private" => self::hasFlag($userAuthority, "ClientModifyPrivate"),
			default => false,
		};
	}
}
