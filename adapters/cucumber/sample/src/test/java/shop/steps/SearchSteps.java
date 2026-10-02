package shop.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URISyntaxException;
import java.time.Duration;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.openqa.selenium.By;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import shop.Browser;

public class SearchSteps {
    private final Browser browser;

    public SearchSteps(Browser browser) {
        this.browser = browser;
    }

    @Given("the shop is open")
    public void theShopIsOpen() throws URISyntaxException {
        browser.openShop();
    }

    @When("I search for {string}")
    public void iSearchFor(String term) {
        browser.driver().findElement(By.id("search")).sendKeys(term);
    }

    @Then("I see {int} result(s)")
    public void iSeeResults(int count) {
        assertEquals(count, browser.driver().findElements(By.cssSelector("#results li")).size(),
                "number of search results");
    }

    @Then("the results appear within {int} milliseconds")
    public void theResultsAppearWithin(int millis) {
        // Waits for a result that only "slow" searches have, so the step times out now and then.
        String selector = Browser.unlucky(0.3) ? "#results li.slow" : "#results li";
        new WebDriverWait(browser.driver(), Duration.ofMillis(millis))
                .until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(selector)));
    }
}
