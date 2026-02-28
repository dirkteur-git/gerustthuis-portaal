import { reactive } from 'vue'

// Gedeelde user state — gebruikt door auth én household
export const userState = reactive({
  profile: null,
  households: [],
  currentHousehold: null,
  currentRole: null,
  loaded: false,
})
