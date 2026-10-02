@search
Feature: Search products
  Shoppers find products by (part of) their name.

  Background:
    Given the shop is open

  @smoke
  Scenario Outline: Searching shows the matching products
    When I search for "<term>"
    Then I see <count> results

    Examples:
      | term     | count |
      | Robot    | 1     |
      | o        | 3     |
      | Selenium | 0     |

  Scenario: Search ignores case
    When I search for "ROBOT"
    Then I see 1 result

  @regression
  Scenario: Search results appear quickly
    When I search for "Keyboard"
    Then the results appear within 300 milliseconds
