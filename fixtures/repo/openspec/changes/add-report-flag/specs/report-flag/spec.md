## Purpose

Lets a project opt out of the weekly report.

## ADDED Requirements

### Requirement: Flag defaults on
A project SHALL receive the report unless its flag is off.

#### Scenario: Flag off skips the project
- **WHEN** the flag is off
- **THEN** the generator writes nothing for that project
