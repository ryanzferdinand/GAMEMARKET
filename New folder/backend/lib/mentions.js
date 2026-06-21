const MENTION_REGEX = /@([a-zA-Z0-9_]{3,20})\b/g

export function extractMentionUsernames(text) {
  if (!text) return []
  const found = [...text.matchAll(MENTION_REGEX)].map((m) => m[1])
  return [...new Set(found)]
}

export async function resolveTaggedUsers(text, User, excludeUserId) {
  const usernames = extractMentionUsernames(text)
  if (!usernames.length) return []

  const users = await User.find({
    $or: usernames.map((name) => ({
      username: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    })),
  }).select('_id username')

  const exclude = excludeUserId?.toString()
  return users.filter((u) => u._id.toString() !== exclude)
}
