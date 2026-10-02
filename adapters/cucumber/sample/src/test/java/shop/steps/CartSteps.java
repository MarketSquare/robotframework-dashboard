package shop.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.cucumber.java.PendingException;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.openqa.selenium.By;
import shop.Browser;

public class CartSteps {
    private final Browser browser;

    public CartSteps(Browser browser) {
        this.browser = browser;
    }

    @Given("I add {int} product(s) to the cart")
    public void iAddProductsToTheCart(int count) {
        for (int i = 0; i < count; i++) {
            browser.driver().findElement(By.id("add")).click();
        }
    }

    @Then("the cart shows {int} item(s)")
    public void theCartShowsItems(int count) {
        // Now and then the cart is one off, to have a flaky scenario that passes when rerun.
        int expected = Browser.unlucky(0.2) ? count + 1 : count;
        assertEquals(String.valueOf(expected), browser.driver().findElement(By.id("cart")).getText(),
                "cart count");
    }

    @When("I go to the checkout")
    public void iGoToTheCheckout() {
        browser.driver().findElement(By.id("checkout")).click();
    }

    @Then("I see the order summary")
    public void iSeeTheOrderSummary() {
        browser.driver().findElement(By.id("summary"));
    }

    @Then("I receive a confirmation email")
    public void iReceiveAConfirmationEmail() {
        throw new PendingException("email check is not automated yet");
    }
}
