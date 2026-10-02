@cart
Feature: Shopping cart

  Background:
    Given the shop is open

  Rule: Products can be added to the cart

    @smoke
    Scenario: Adding a product
      When I add 1 product to the cart
      Then the cart shows 1 item

    Scenario: Adding several products
      When I add 3 products to the cart
      Then the cart shows 3 items

  Rule: An order can be placed

    @wip
    Scenario: Checking out
      Given I add 1 product to the cart
      When I go to the checkout
      Then I see the order summary

    @wip
    Scenario: Paying with a gift card
      Given I add 1 product to the cart
      When I pay with a gift card
      Then I receive a confirmation email

    Scenario: Order confirmation
      Given I add 2 products to the cart
      Then I receive a confirmation email
