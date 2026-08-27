import type { Exercise, WorkoutProgram } from "./types";

export const SPORTS = [
  "Gym",
  "Calisthenics",
  "Running",
  "Football",
  "Swimming",
  "Cycling",
  "Martial arts",
  "Yoga",
  "Other",
];

export const DEFAULT_EXERCISES: Exercise[] = [
  // Gym - Chest
  { id: "ex-bench-press", name: "Barbell Bench Press", category: "Gym", primaryMuscle: "Chest", equipment: "Barbell", instructions: "Retract scapula, touch chest gently, press up linearly." },
  { id: "ex-incline-db-press", name: "Incline Dumbbell Press", category: "Gym", primaryMuscle: "Chest", equipment: "Dumbbell", instructions: "Set bench to 30 degrees. Lower DBs with elbows at 45 degrees." },
  { id: "ex-decline-bench", name: "Decline Barbell Press", category: "Gym", primaryMuscle: "Chest", equipment: "Barbell", instructions: "Lower to lower sternum, press up with controlled torso angle." },
  { id: "ex-chest-dips", name: "Weighted Chest Dips", category: "Gym", primaryMuscle: "Chest", equipment: "Bodyweight", instructions: "Lean forward 30 degrees, dip until deep chest stretch." },
  { id: "ex-cable-fly", name: "Cable Chest Fly", category: "Gym", primaryMuscle: "Chest", equipment: "Cable", instructions: "Keep subtle bend in elbows, hug a tree motion." },
  { id: "ex-pec-deck", name: "Pec Deck Machine Fly", category: "Gym", primaryMuscle: "Chest", equipment: "Machine", instructions: "Keep elbows high and squeeze inner chest at peak contraction." },

  // Gym - Back
  { id: "ex-barbell-row", name: "Barbell Bent-Over Row", category: "Gym", primaryMuscle: "Back", equipment: "Barbell", instructions: "Hinge hips at 45 degrees, pull bar towards belly button." },
  { id: "ex-lat-pulldown", name: "Lat Pulldown", category: "Gym", primaryMuscle: "Back", equipment: "Cable", instructions: "Drive elbows down and back, pull chest up towards bar." },
  { id: "ex-deadlift", name: "Barbell Deadlift", category: "Gym", primaryMuscle: "Back", equipment: "Barbell", instructions: "Keep spine neutral, drag bar up shins, drive hips forward." },
  { id: "ex-seated-cable-row", name: "Seated Cable Row", category: "Gym", primaryMuscle: "Back", equipment: "Cable", instructions: "Keep torso upright, drive elbows back into sides." },
  { id: "ex-t-bar-row", name: "T-Bar Row", category: "Gym", primaryMuscle: "Back", equipment: "Barbell", instructions: "Pull with chest supported or hinged torso, squeeze mid back." },
  { id: "ex-single-arm-db-row", name: "Single-Arm Dumbbell Row", category: "Gym", primaryMuscle: "Back", equipment: "Dumbbell", instructions: "Pull DB to hip pocket while bracing on bench." },
  { id: "ex-face-pull", name: "Cable Face Pull", category: "Gym", primaryMuscle: "Shoulders", equipment: "Cable", instructions: "Pull rope to nose level, externally rotating shoulders." },
  { id: "ex-hyperextensions", name: "Back Hyperextensions", category: "Gym", primaryMuscle: "Back", equipment: "Machine", instructions: "Hinge at hips, squeeze lower back and glutes at top." },
  { id: "ex-shrugs", name: "Barbell Shrugs", category: "Gym", primaryMuscle: "Back", equipment: "Barbell", instructions: "Elevate shoulders straight up towards ears without rolling." },

  // Gym - Shoulders
  { id: "ex-overhead-press", name: "Overhead Barbell Press", category: "Gym", primaryMuscle: "Shoulders", equipment: "Barbell", instructions: "Brace core, press overhead lock out without arching back." },
  { id: "ex-lateral-raise", name: "Dumbbell Lateral Raise", category: "Gym", primaryMuscle: "Shoulders", equipment: "Dumbbell", instructions: "Raise DBs out to sides with slight forward angle." },
  { id: "ex-arnold-press", name: "Arnold Dumbbell Press", category: "Gym", primaryMuscle: "Shoulders", equipment: "Dumbbell", instructions: "Rotate palms from facing chest to facing forward as you press." },
  { id: "ex-cable-lateral-raise", name: "Cable Lateral Raise", category: "Gym", primaryMuscle: "Shoulders", equipment: "Cable", instructions: "Continuous tension on side delts through full ROM." },
  { id: "ex-rear-delt-fly", name: "Reverse Pec Deck (Rear Delt Fly)", category: "Gym", primaryMuscle: "Shoulders", equipment: "Machine", instructions: "Lead with elbows out to sides to target rear deltoids." },
  { id: "ex-push-press", name: "Barbell Push Press", category: "Gym", primaryMuscle: "Shoulders", equipment: "Barbell", instructions: "Dip knees slightly and use leg drive to overhead lockout." },

  // Gym - Legs (Quads & Calves)
  { id: "ex-barbell-squat", name: "Barbell Back Squat", category: "Gym", primaryMuscle: "Quads", equipment: "Barbell", instructions: "Break hips & knees simultaneously, squat below parallel." },
  { id: "ex-front-squat", name: "Front Squat", category: "Gym", primaryMuscle: "Quads", equipment: "Barbell", instructions: "Keep elbows high, rack bar across front delts." },
  { id: "ex-leg-press", name: "Leg Press", category: "Gym", primaryMuscle: "Quads", equipment: "Machine", instructions: "Keep lower back glued to pad, lower weight to 90 degrees." },
  { id: "ex-goblet-squat", name: "Dumbbell Goblet Squat", category: "Gym", primaryMuscle: "Quads", equipment: "Dumbbell", instructions: "Hold DB vertical against chest, keep upright torso." },
  { id: "ex-hack-squat", name: "Hack Squat Machine", category: "Gym", primaryMuscle: "Quads", equipment: "Machine", instructions: "Full depth quad isolation with back supported." },
  { id: "ex-leg-extension", name: "Leg Extension Machine", category: "Gym", primaryMuscle: "Quads", equipment: "Machine", instructions: "Squeeze quads hard at top extension." },
  { id: "ex-db-lunges", name: "Dumbbell Walking Lunges", category: "Gym", primaryMuscle: "Quads", equipment: "Dumbbell", instructions: "Take long strides, lower back knee close to ground." },
  { id: "ex-bulgarian-split-squat", name: "Bulgarian Split Squat", category: "Gym", primaryMuscle: "Quads", equipment: "Dumbbell", instructions: "Rear foot elevated on bench, lower front thigh parallel." },
  { id: "ex-standing-calf-raise", name: "Standing Calf Raise", category: "Gym", primaryMuscle: "Core", equipment: "Machine", instructions: "Full stretch at bottom, press up on toes at top." },

  // Gym - Legs (Hamstrings & Glutes)
  { id: "ex-romanian-deadlift", name: "Romanian Deadlift", category: "Gym", primaryMuscle: "Hamstrings", equipment: "Barbell", instructions: "Push hips back, lower bar along thighs until hamstring stretch." },
  { id: "ex-lying-leg-curl", name: "Lying Leg Curl", category: "Gym", primaryMuscle: "Hamstrings", equipment: "Machine", instructions: "Squeeze hamstrings at peak contraction." },
  { id: "ex-seated-leg-curl", name: "Seated Leg Curl", category: "Gym", primaryMuscle: "Hamstrings", equipment: "Machine", instructions: "Flex toes towards shins, curl fully back." },
  { id: "ex-hip-thrust", name: "Barbell Hip Thrust", category: "Gym", primaryMuscle: "Glutes", equipment: "Barbell", instructions: "Upper back on bench, drive hips up through heels, squeeze glutes." },

  // Gym - Arms
  { id: "ex-db-bicep-curl", name: "Dumbbell Bicep Curl", category: "Gym", primaryMuscle: "Biceps", equipment: "Dumbbell", instructions: "Keep upper arms stationary, Supinate wrist at top." },
  { id: "ex-preacher-curl", name: "Preacher Curl", category: "Gym", primaryMuscle: "Biceps", equipment: "Barbell", instructions: "Strict bicep isolation with upper arms fixed on pad." },
  { id: "ex-hammer-curl", name: "Dumbbell Hammer Curl", category: "Gym", primaryMuscle: "Biceps", equipment: "Dumbbell", instructions: "Neutral grip to target brachialis and forearm." },
  { id: "ex-tricep-pushdown", name: "Cable Tricep Pushdown", category: "Gym", primaryMuscle: "Triceps", equipment: "Cable", instructions: "Pin elbows at sides, extend forearms downwards." },
  { id: "ex-skullcrushers", name: "EZ-Bar Skullcrushers", category: "Gym", primaryMuscle: "Triceps", equipment: "Barbell", instructions: "Lower bar towards forehead, extend elbows overhead." },
  { id: "ex-close-grip-bench", name: "Close-Grip Bench Press", category: "Gym", primaryMuscle: "Triceps", equipment: "Barbell", instructions: "Grip shoulder width, keep elbows tucked to sides." },

  // Gym - Core
  { id: "ex-cable-crunch", name: "Cable Kneeling Crunch", category: "Gym", primaryMuscle: "Core", equipment: "Cable", instructions: "Flex spine downward using abs, not hip flexors." },
  { id: "ex-ab-wheel", name: "Ab Wheel Rollout", category: "Gym", primaryMuscle: "Core", equipment: "Bodyweight", instructions: "Roll out while maintaining hollow body posture." },
  { id: "ex-russian-twist", name: "Weighted Russian Twist", category: "Gym", primaryMuscle: "Core", equipment: "Dumbbell", instructions: "Rotate torso side to side with feet elevated." },

  // Calisthenics
  { id: "ex-pushups", name: "Push-ups", category: "Calisthenics", primaryMuscle: "Chest", equipment: "Bodyweight", instructions: "Maintain rigid plank, chest to floor." },
  { id: "ex-pullups", name: "Pull-ups", category: "Calisthenics", primaryMuscle: "Back", equipment: "Bodyweight", instructions: "Full dead hang to chin over bar." },
  { id: "ex-chinups", name: "Chin-ups", category: "Calisthenics", primaryMuscle: "Biceps", equipment: "Bodyweight", instructions: "Underhand grip, drive elbows down to bar." },
  { id: "ex-dips", name: "Parallel Bar Dips", category: "Calisthenics", primaryMuscle: "Triceps", equipment: "Bodyweight", instructions: "Lean slightly forward, lower shoulders past elbows." },
  { id: "ex-muscle-ups", name: "Bar Muscle-up", category: "Calisthenics", primaryMuscle: "Full Body", equipment: "Bodyweight", instructions: "Explosive pull up with wrist transition above bar." },
  { id: "ex-archer-pushups", name: "Archer Push-ups", category: "Calisthenics", primaryMuscle: "Chest", equipment: "Bodyweight", instructions: "Extend one arm sideways while lowering on primary arm." },
  { id: "ex-diamond-pushups", name: "Diamond Push-ups", category: "Calisthenics", primaryMuscle: "Triceps", equipment: "Bodyweight", instructions: "Index fingers and thumbs touching under chest." },
  { id: "ex-pike-pushups", name: "Pike Push-ups", category: "Calisthenics", primaryMuscle: "Shoulders", equipment: "Bodyweight", instructions: "Elevate hips overhead, lower forehead forward." },
  { id: "ex-handstand-pushups", name: "Handstand Push-ups", category: "Calisthenics", primaryMuscle: "Shoulders", equipment: "Bodyweight", instructions: "Against wall or free-standing overhead shoulder press." },
  { id: "ex-ring-dips", name: "Gymnastic Ring Dips", category: "Calisthenics", primaryMuscle: "Chest", equipment: "Bodyweight", instructions: "Turn rings out at top of extension." },
  { id: "ex-hanging-leg-raise", name: "Hanging Leg Raise", category: "Calisthenics", primaryMuscle: "Core", equipment: "Bodyweight", instructions: "Raise legs to horizontal without swinging." },
  { id: "ex-l-sit", name: "L-Sit Hold", category: "Calisthenics", primaryMuscle: "Core", equipment: "Bodyweight", instructions: "Hold legs horizontal off ground on dip bars or floor." },
  { id: "ex-pistol-squat", name: "Single-Leg Pistol Squat", category: "Calisthenics", primaryMuscle: "Quads", equipment: "Bodyweight", instructions: "Squat on one leg with opposite leg extended forward." },
  { id: "ex-nordic-curl", name: "Nordic Hamstring Curl", category: "Calisthenics", primaryMuscle: "Hamstrings", equipment: "Bodyweight", instructions: "Lower torso forward with ankles anchored." },

  // Running
  { id: "ex-outdoor-run", name: "Outdoor Distance Run", category: "Running", primaryMuscle: "Cardio", equipment: "Track", instructions: "Maintain smooth cadence and steady controlled breathing." },
  { id: "ex-interval-sprints", name: "Interval Sprint Repeat", category: "Running", primaryMuscle: "Cardio", equipment: "Track", instructions: "High effort sprint followed by active jog rest." },
  { id: "ex-tempo-run", name: "Treadmill Tempo Run", category: "Running", primaryMuscle: "Cardio", equipment: "Treadmill", instructions: "Sustained comfortably hard pace at lactate threshold." },
  { id: "ex-hill-sprints", name: "Hill Sprint Repeats", category: "Running", primaryMuscle: "Cardio", equipment: "Track", instructions: "Maximal effort sprinting up incline grade." },
  { id: "ex-fartlek-run", name: "Fartlek Speed Play Run", category: "Running", primaryMuscle: "Cardio", equipment: "Track", instructions: "Alternate unstructured fast bursts with recovery jogs." },

  // Swimming
  { id: "ex-freestyle-laps", name: "Freestyle Laps", category: "Swimming", primaryMuscle: "Full Body", equipment: "Pool", instructions: "Streamlined posture, continuous kick, bilateral breathing." },
  { id: "ex-breaststroke-laps", name: "Breaststroke Laps", category: "Swimming", primaryMuscle: "Full Body", equipment: "Pool", instructions: "Glide after whip kick." },
  { id: "ex-backstroke-laps", name: "Backstroke Laps", category: "Swimming", primaryMuscle: "Full Body", equipment: "Pool", instructions: "Continuous flutter kick with high hip position." },
  { id: "ex-butterfly-laps", name: "Butterfly Laps", category: "Swimming", primaryMuscle: "Full Body", equipment: "Pool", instructions: "Undulating dolphin kick with synchronized arm sweep." },
  { id: "ex-medley-swim", name: "Individual Medley (IM)", category: "Swimming", primaryMuscle: "Full Body", equipment: "Pool", instructions: "Combine Fly, Back, Breast, and Free in set lap rotations." },

  // Boxing / Combat
  { id: "ex-heavy-bag", name: "Heavy Bag Combination Work", category: "Boxing/Martial Arts", primaryMuscle: "Full Body", equipment: "Ring/Bag", instructions: "Maintain guard, snap punches, move feet between combos." },
  { id: "ex-sparring", name: "Controlled Sparring", category: "Boxing/Martial Arts", primaryMuscle: "Full Body", equipment: "Ring/Bag", instructions: "Practice defense, timing, distance, and counter-attacks." },
  { id: "ex-shadowboxing", name: "Shadowboxing Rounds", category: "Boxing/Martial Arts", primaryMuscle: "Full Body", equipment: "Bodyweight", instructions: "Focus on fluid footwork, head movement, and punch form." },
  { id: "ex-focus-mitts", name: "Focus Mitts Pad Work", category: "Boxing/Martial Arts", primaryMuscle: "Full Body", equipment: "Ring/Bag", instructions: "Fast precision combos with coach holding mitts." },
  { id: "ex-thai-pads", name: "Thai Pad Kicks & Knees", category: "Boxing/Martial Arts", primaryMuscle: "Full Body", equipment: "Ring/Bag", instructions: "Heavy roundhouse kicks and knee strikes on pads." },
  { id: "ex-jump-rope", name: "Jump Rope Conditioning", category: "Boxing/Martial Arts", primaryMuscle: "Cardio", equipment: "Bodyweight", instructions: "Fast footwork drills, double-unders, and rhythm stay." },

  // Cycling & Functional Fitness / Other
  { id: "ex-road-cycling", name: "Outdoor Road Cycling", category: "Other", primaryMuscle: "Cardio", equipment: "Other", instructions: "Maintain steady cadence on bike route." },
  { id: "ex-bike-intervals", name: "Stationary Bike Interval Sprints", category: "Other", primaryMuscle: "Cardio", equipment: "Machine", instructions: "30s max effort sprint / 30s light spin." },
  { id: "ex-rowing-erg", name: "Ergometer Indoor Rowing", category: "Other", primaryMuscle: "Full Body", equipment: "Machine", instructions: "Drive with legs, lean back slightly, pull to sternum." },
  { id: "ex-kettlebell-swings", name: "Kettlebell Swings", category: "Other", primaryMuscle: "Full Body", equipment: "Dumbbell", instructions: "Explosive hip hinge, drive KB to chest height." },
  { id: "ex-farmers-walk", name: "Farmer's Walk Heavy Carry", category: "Other", primaryMuscle: "Full Body", equipment: "Dumbbell", instructions: "Walk with tall posture carrying heavy weights." },
  { id: "ex-wall-balls", name: "Wall Ball Shots", category: "Other", primaryMuscle: "Full Body", equipment: "Other", instructions: "Squat deep, throw medicine ball to target line." },
  { id: "ex-box-jumps", name: "Plyometric Box Jumps", category: "Other", primaryMuscle: "Quads", equipment: "Other", instructions: "Soft landing on box, step down safely." },
  { id: "ex-burpees", name: "Full Burpees", category: "Other", primaryMuscle: "Full Body", equipment: "Bodyweight", instructions: "Chest to floor, jump up with hands overhead." },
];

export const DEFAULT_PROGRAMS: WorkoutProgram[] = [
  {
    id: "prog-ppl",
    name: "Push / Pull / Legs (PPL)",
    description: "Classic 3-day hypertrophy & strength split.",
    sport: "Gym",
    active: true,
    sessions: [
      {
        id: "sess-push",
        name: "Push Day (Chest, Shoulders, Triceps)",
        dayName: "Day 1",
        sport: "Gym",
        exercises: [
          {
            exerciseId: "ex-bench-press",
            exerciseName: "Barbell Bench Press",
            targetSets: [
              { type: "W", reps: 10, weightKg: 50 },
              { type: "N", reps: 8, weightKg: 70, rpe: 8, restSec: 120 },
              { type: "N", reps: 8, weightKg: 70, rpe: 8, restSec: 120 },
              { type: "N", reps: 8, weightKg: 70, rpe: 9, restSec: 120 },
            ],
            progressionRule: "+2.5kg when all sets reach 8 reps",
          },
          {
            exerciseId: "ex-incline-db-press",
            exerciseName: "Incline Dumbbell Press",
            targetSets: [
              { type: "N", reps: 10, weightKg: 24, rpe: 8, restSec: 90 },
              { type: "N", reps: 10, weightKg: 24, rpe: 9, restSec: 90 },
              { type: "N", reps: 10, weightKg: 24, rpe: 9, restSec: 90 },
            ],
          },
          {
            exerciseId: "ex-lateral-raise",
            exerciseName: "Dumbbell Lateral Raise",
            targetSets: [
              { type: "N", reps: 12, weightKg: 10, rpe: 8, restSec: 60 },
              { type: "N", reps: 12, weightKg: 10, rpe: 9, restSec: 60 },
              { type: "N", reps: 15, weightKg: 10, rpe: 10, restSec: 60 },
            ],
          },
          {
            exerciseId: "ex-tricep-pushdown",
            exerciseName: "Cable Tricep Pushdown",
            targetSets: [
              { type: "N", reps: 12, weightKg: 30, rpe: 8, restSec: 60 },
              { type: "N", reps: 12, weightKg: 30, rpe: 9, restSec: 60 },
            ],
          },
        ],
      },
      {
        id: "sess-pull",
        name: "Pull Day (Back & Biceps)",
        dayName: "Day 2",
        sport: "Gym",
        exercises: [
          {
            exerciseId: "ex-barbell-row",
            exerciseName: "Barbell Bent-Over Row",
            targetSets: [
              { type: "N", reps: 8, weightKg: 60, rpe: 8, restSec: 120 },
              { type: "N", reps: 8, weightKg: 60, rpe: 8, restSec: 120 },
              { type: "N", reps: 8, weightKg: 60, rpe: 9, restSec: 120 },
            ],
          },
          {
            exerciseId: "ex-lat-pulldown",
            exerciseName: "Lat Pulldown",
            targetSets: [
              { type: "N", reps: 10, weightKg: 55, rpe: 8, restSec: 90 },
              { type: "N", reps: 10, weightKg: 55, rpe: 9, restSec: 90 },
              { type: "N", reps: 10, weightKg: 55, rpe: 9, restSec: 90 },
            ],
          },
          {
            exerciseId: "ex-db-bicep-curl",
            exerciseName: "Dumbbell Bicep Curl",
            targetSets: [
              { type: "N", reps: 12, weightKg: 12, rpe: 8, restSec: 60 },
              { type: "N", reps: 12, weightKg: 12, rpe: 9, restSec: 60 },
            ],
          },
        ],
      },
      {
        id: "sess-legs",
        name: "Leg Day (Quads, Hamstrings, Calves)",
        dayName: "Day 3",
        sport: "Gym",
        exercises: [
          {
            exerciseId: "ex-barbell-squat",
            exerciseName: "Barbell Back Squat",
            targetSets: [
              { type: "W", reps: 10, weightKg: 60 },
              { type: "N", reps: 8, weightKg: 90, rpe: 8, restSec: 120 },
              { type: "N", reps: 8, weightKg: 90, rpe: 8, restSec: 120 },
              { type: "N", reps: 8, weightKg: 90, rpe: 9, restSec: 120 },
            ],
          },
          {
            exerciseId: "ex-romanian-deadlift",
            exerciseName: "Romanian Deadlift",
            targetSets: [
              { type: "N", reps: 10, weightKg: 70, rpe: 8, restSec: 90 },
              { type: "N", reps: 10, weightKg: 70, rpe: 9, restSec: 90 },
            ],
          },
          {
            exerciseId: "ex-leg-press",
            exerciseName: "Leg Press",
            targetSets: [
              { type: "N", reps: 12, weightKg: 140, rpe: 8, restSec: 90 },
              { type: "N", reps: 12, weightKg: 140, rpe: 9, restSec: 90 },
            ],
          },
        ],
      },
    ],
  },
];
