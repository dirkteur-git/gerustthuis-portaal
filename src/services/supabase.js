// Barrel re-export — bestaande imports werken ongewijzigd
// Domein-specifieke code staat in de losse bestanden hiernaast

export { supabase, activityDb, integrationsDb } from './client'
export { userState } from './state'
export { getCurrentUser, signIn, resetPasswordForEmail, updatePassword, signOut, onAuthStateChange } from './auth'
export {
  loadUserProfile, isAdmin, getCurrentRole, getCurrentHouseholdId,
  switchHousehold, getAllHouseholds, getHouseholdMembers,
  inviteToHousehold, acceptInvitation, removeMember, getHouseholdInvitations,
} from './household'
export {
  getHueConfig, saveHueConfig, getDevices, getLights, getSensors,
  getPhysicalDevices, getAllSensors, getRooms, getDevicesByRoom,
} from './devices'
export { getResident } from './residents'
export {
  getFamilyBoardMessages, postFamilyBoardMessage,
  getNotifications, markNotificationRead, markAllNotificationsRead,
} from './messages'
export { getRecentEvents } from './activity'
