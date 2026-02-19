# Karel Refactor Plan

## Overview

This document outlines the refactoring plan to transform the Karel playground into a reusable component architecture that can be embedded in lessons with configurable features, testing, and validation.

## Goals

1. **Create Reusable Component**: Extract playground logic into `KarelEnvironment` component
2. **Enable Configuration**: Support per-instance feature restrictions and testing
3. **Maintain Playground**: Refactor playground to use new component without losing functionality
4. **Support Lessons**: Enable embedding Karel environments in lesson markdown files

## What's Changing

### New Architecture

**Before:**

- Playground page (`/karel/playground/+page.svelte`) contains all execution logic
- Everything is tightly coupled to the playground page
- No way to embed Karel in lessons

**After:**

- `KarelEnvironment.svelte` - Reusable core component with configurable props
- Playground uses `KarelEnvironment` with `showWorldEditor={true}`
- Lessons embed `KarelEnvironment` with custom configurations
- Each instance can have different feature restrictions and tests

### Key Components

1. **KarelEnvironment** (new) - Core reusable component
2. **Playground** (refactored) - Wraps KarelEnvironment + WorldEditor
3. **Feature Validator** (enhanced) - Now accepts allowed features configuration
4. **Test Runner** (new) - Executes code against multiple test worlds

## What's Staying the Same

- ✅ All existing playground functionality
- ✅ KarelWorld, KarelCodeEditor, KarelControls, KarelOutput components
- ✅ Pyodide integration and Karel command implementations
- ✅ Animation system (record-and-replay)
- ✅ World editor functionality
- ✅ Step-through execution
- ✅ All Karel commands and sensor functions

## Technical Approach

### 1. KarelConfig Interface

Create type definition for component configuration:

```typescript
// src/lib/karel/types.ts
export interface KarelConfig {
  initialWorld: KarelWorld;
  initialCode: string;
  allowedFeatures?: {
    karelCommands?: string[];
    pythonFeatures?: string[];
  };
  tests?: {
    worlds: { [testName: string]: KarelWorld };
    validate: (world: KarelWorld) => { passed: boolean; message: string };
    loadableTests?: string[];
  };
  showWorldEditor?: boolean;
}
```

### 2. Code Validator Enhancement

Update validator to accept allowed features:

```python
# In pyodide.ts - installCodeValidator function
def validate_karel_code(code, allowed_commands=None, allowed_features=None):
    # If None, allow all (playground mode)
    # If lists provided, restrict to those features
    ...
```

### 3. Test Runner

New functionality in KarelEnvironment:

```typescript
async function runTests() {
  const results = [];
  for (const [testName, testWorld] of Object.entries(config.tests.worlds)) {
    resetToWorld(testWorld);
    await executeCode();
    const result = config.tests.validate(currentWorld);
    results.push({ testName, ...result });
  }
  return results;
}
```

### 4. Component Extraction

Move from playground to KarelEnvironment:

- Execution state management
- Code execution logic
- Animation system
- Karel command implementations
- Pyodide initialization
- Control handlers (play/pause/step/reset)

Keep in playground:

- World editor state
- Mode switching (Play/Edit)
- World import/export
- Default world and code

---

## Implementation TODO List

### Phase 1: Setup & Types

- [ ] **Task 1.1**: Add `KarelConfig` interface to `src/lib/karel/types.ts`

  - [ ] Define interface with all required and optional properties
  - [ ] Export interface for use in components
  - [ ] Add JSDoc comments

- [ ] **Task 1.2**: Update `pyodide.ts` to export validator enhancement functions
  - [ ] Modify `installCodeValidator` to accept allowed features parameters
  - [ ] Update Python AST validation code to check against allowed lists
  - [ ] Add `validateKarelCodeWithFeatures` function that wraps the Python validator

### Phase 2: Create KarelEnvironment Component

- [ ] **Task 2.1**: Create `src/lib/components/KarelEnvironment.svelte`

  - [ ] Set up component structure with props interface
  - [ ] Accept `config` prop of type `KarelConfig`
  - [ ] Initialize component state (execution, world, animation)

- [ ] **Task 2.2**: Move Pyodide integration to KarelEnvironment

  - [ ] Copy Pyodide loading logic from playground
  - [ ] Set up Karel command callbacks
  - [ ] Initialize validator with allowed features

- [ ] **Task 2.3**: Move Karel command implementations to KarelEnvironment

  - [ ] Copy all Karel command functions (move, turn_left, pick_beeper, put_beeper)
  - [ ] Copy all sensor functions (front_is_clear, beepers_present, etc.)
  - [ ] Update to use component's state

- [ ] **Task 2.4**: Move execution logic to KarelEnvironment

  - [ ] Copy code execution flow
  - [ ] Copy record-and-replay animation system
  - [ ] Copy step-through execution logic
  - [ ] Update to use config.initialWorld and config.initialCode

- [ ] **Task 2.5**: Add control handlers to KarelEnvironment
  - [ ] Implement play/pause/step/reset handlers
  - [ ] Wire up to KarelControls component
  - [ ] Manage execution state properly

### Phase 3: Feature Restriction System

- [ ] **Task 3.1**: Enhance Python validator in `pyodide.ts`

  - [ ] Modify `validate_karel_code` to accept `allowed_commands` parameter
  - [ ] Modify `validate_karel_code` to accept `allowed_features` parameter
  - [ ] Update Karel function checking logic
  - [ ] Update Python feature checking logic
  - [ ] Add clear error messages for restricted features

- [ ] **Task 3.2**: Integrate validator with KarelEnvironment

  - [ ] Pass `config.allowedFeatures.karelCommands` to validator
  - [ ] Pass `config.allowedFeatures.pythonFeatures` to validator
  - [ ] Handle validation errors appropriately
  - [ ] Default to all features if not specified (playground mode)

- [ ] **Task 3.3**: Test feature restrictions
  - [ ] Test Karel command restrictions
  - [ ] Test Python feature restrictions
  - [ ] Test error messages
  - [ ] Test playground mode (no restrictions)

### Phase 4: Testing Support

- [ ] **Task 4.1**: Add test execution logic to KarelEnvironment

  - [ ] Create `runTests()` function
  - [ ] Loop through `config.tests.worlds`
  - [ ] Execute code against each test world
  - [ ] Call `config.tests.validate()` for each result
  - [ ] Collect and format results

- [ ] **Task 4.2**: Add test world dropdown to KarelControls

  - [ ] Show dropdown when `config.tests.loadableTests` provided
  - [ ] Populate with test names
  - [ ] Handle selection to load test world into display
  - [ ] Update KarelWorld component when test world selected

- [ ] **Task 4.3**: Update KarelControls component

  - [ ] Add "Run Tests" button (show when `config.tests` provided)
  - [ ] Add test world dropdown (show when `config.tests.loadableTests` provided)
  - [ ] Emit events to parent component
  - [ ] Handle button states appropriately

- [ ] **Task 4.4**: Update KarelOutput component

  - [ ] Add test results display section
  - [ ] Show "✓ All tests passed!" for all passing
  - [ ] Show individual test results for failures
  - [ ] Format test result messages clearly

- [ ] **Task 4.5**: Test the testing system
  - [ ] Create test config with single test
  - [ ] Create test config with multiple tests
  - [ ] Test validation passing
  - [ ] Test validation failing
  - [ ] Test loadable tests dropdown

### Phase 5: Refactor Playground

- [ ] **Task 5.1**: Update playground to use KarelEnvironment

  - [ ] Import KarelEnvironment component
  - [ ] Create default config object
  - [ ] Replace execution logic with KarelEnvironment
  - [ ] Keep world editor logic in playground

- [ ] **Task 5.2**: Wire up world editor to KarelEnvironment

  - [ ] Pass `showWorldEditor={true}` to KarelEnvironment
  - [ ] Handle world changes from editor
  - [ ] Update KarelEnvironment's initialWorld when edited
  - [ ] Maintain mode switching functionality

- [ ] **Task 5.3**: Clean up playground code

  - [ ] Remove duplicated execution logic
  - [ ] Remove duplicated Karel command implementations
  - [ ] Remove duplicated Pyodide integration
  - [ ] Keep only world editor and mode switching logic

- [ ] **Task 5.4**: Test playground functionality
  - [ ] Test world editing still works
  - [ ] Test mode switching still works
  - [ ] Test code execution still works
  - [ ] Test all existing playground features
  - [ ] Test world import/export still works

### Phase 6: Integration & Testing

- [ ] **Task 6.1**: Create example lesson page

  - [ ] Create test route (e.g., `/karel/test-lesson`)
  - [ ] Create simple .svelte page (not .svx yet)
  - [ ] Embed KarelEnvironment with simple config
  - [ ] Test rendering and execution

- [ ] **Task 6.2**: Test single-test exercise

  - [ ] Create config with one test world
  - [ ] Add validation function
  - [ ] Test "Run Tests" button
  - [ ] Test passing validation
  - [ ] Test failing validation

- [ ] **Task 6.3**: Test multi-test exercise

  - [ ] Create config with multiple test worlds
  - [ ] Add loadableTests array
  - [ ] Test "Run Tests" button
  - [ ] Test test world dropdown
  - [ ] Test all pass scenario
  - [ ] Test some fail scenario

- [ ] **Task 6.4**: Test feature restrictions

  - [ ] Create config with restricted Karel commands
  - [ ] Create config with restricted Python features
  - [ ] Test validation catches violations
  - [ ] Test error messages are clear

- [ ] **Task 6.5**: End-to-end testing
  - [ ] Test playground still fully functional
  - [ ] Test embedded environments work
  - [ ] Test multiple environments on same page
  - [ ] Test switching between different lesson pages
  - [ ] Test Pyodide sharing between instances

### Phase 7: Documentation & Polish

- [ ] **Task 7.1**: Update component documentation

  - [ ] Document KarelEnvironment props
  - [ ] Document KarelConfig interface
  - [ ] Add usage examples
  - [ ] Document feature restriction options

- [ ] **Task 7.2**: Create lesson authoring guide

  - [ ] How to create simple examples
  - [ ] How to create single-test exercises
  - [ ] How to create multi-test exercises
  - [ ] How to restrict features
  - [ ] How to write validation functions

- [ ] **Task 7.3**: Update PROGRESS.md

  - [ ] Mark Phase 3 tasks as complete
  - [ ] Document new capabilities
  - [ ] List any known issues or limitations

- [ ] **Task 7.4**: Code cleanup
  - [ ] Remove any commented-out code
  - [ ] Ensure consistent formatting
  - [ ] Add TypeScript type safety checks
  - [ ] Run linter and fix issues

---

## Dependencies & Order

### Critical Path

1. **Types first** (Task 1.1) - Everything depends on this
2. **KarelEnvironment shell** (Task 2.1) - Set up structure
3. **Move execution logic** (Tasks 2.2-2.5) - Core functionality
4. **Feature restrictions** (Tasks 3.1-3.3) - Before testing
5. **Testing system** (Tasks 4.1-4.5) - Can be parallel with Phase 5
6. **Refactor playground** (Tasks 5.1-5.4) - Depends on KarelEnvironment being complete
7. **Integration testing** (Phase 6) - After everything else
8. **Documentation** (Phase 7) - Final polish

### Parallel Work Opportunities

- Tasks 3.x and 4.x can be done in parallel (feature restrictions and testing)
- Tasks 4.2-4.4 (UI changes) can be done in parallel with 4.1 (logic)

---

## Testing Strategy

### Unit Testing

- Test KarelConfig validation
- Test feature restriction validator
- Test test runner logic

### Integration Testing

- Test KarelEnvironment in isolation
- Test playground with KarelEnvironment
- Test lesson embedding

### Manual Testing Checklist

**Playground:**

- [ ] Can create and edit worlds
- [ ] Can run code
- [ ] Can step through code
- [ ] Can pause/resume execution
- [ ] Can reset to initial state
- [ ] Animation speed control works
- [ ] World import/export works
- [ ] Mode switching works

**Simple Example:**

- [ ] Code editor displays initial code
- [ ] Can edit code
- [ ] Can run code
- [ ] Karel world updates correctly
- [ ] Errors display properly

**Single Test Exercise:**

- [ ] "Run Tests" button appears
- [ ] Running test executes code
- [ ] Validation passes when correct
- [ ] Validation fails when incorrect
- [ ] Error messages are clear

**Multi-Test Exercise:**

- [ ] "Run Tests" button appears
- [ ] Test world dropdown appears
- [ ] Can select different test worlds
- [ ] All tests run when button clicked
- [ ] Results show correctly (all pass or detailed failures)

**Feature Restrictions:**

- [ ] Restricted Karel commands blocked
- [ ] Restricted Python features blocked
- [ ] Error messages explain what's not allowed
- [ ] Unrestricted features still work

---

## Rollback Plan

If issues arise:

1. **Keep original playground backup**: Before starting, create branch with current playground
2. **Incremental commits**: Commit after each major task completion
3. **Feature flags**: Could add flag to switch between old/new implementations during transition
4. **Separate routes**: Keep `/karel/playground-old` as backup during development

---

## Success Criteria

### Phase 3 Complete When:

- ✅ KarelEnvironment component exists and works
- ✅ Playground uses KarelEnvironment
- ✅ Feature restrictions work
- ✅ Testing system works
- ✅ Can embed Karel in lesson pages
- ✅ All existing playground functionality preserved
- ✅ Documentation updated

### Quality Checks:

- ✅ No TypeScript errors
- ✅ No console errors during execution
- ✅ Pyodide loads correctly
- ✅ All Karel commands work
- ✅ Animation system works
- ✅ Step-through debugging works
- ✅ All manual testing checklist items pass

---

## Notes & Considerations

### Performance

- **Pyodide Sharing**: Multiple KarelEnvironment instances should share single Pyodide instance
- **Memory**: Each instance maintains its own world state - acceptable for typical lesson page
- **Animation**: Each instance can animate independently

### Edge Cases

- **No tests provided**: Component works as simple example (no "Run Tests" button)
- **Empty allowedFeatures**: Defaults to all features allowed (playground mode)
- **Test world same as initial world**: Totally fine (single-test exercises)
- **Large test suite**: UI should handle gracefully (scrollable results)

### Future Enhancements

- Code persistence per exercise (localStorage)
- Progress tracking integration
- Hints system
- Solution reveal functionality
- Syntax highlighting for errors
- Better mobile responsiveness

---

## Document Version

- **Version**: 1.0
- **Date**: February 13, 2026
- **Status**: Ready for implementation
