#include <iostream> // Required for input/output operations (cin, cout)

int main() {
    // Declare two integer variables to store the numbers
    int number1;
    int number2;

    // Prompt the user to enter the first number
    std::cout << "Enter the first number: ";
    // Read the first number from the user's input
    std::cin >> number1;

    // Prompt the user to enter the second number
    std::cout << "Enter the second number: ";
    // Read the second number from the user's input
    std::cin >> number2;

    // Calculate the sum of the two numbers
    int sum = number1 + number2;

    // Display the result to the user
    std::cout << "The sum of " << number1 << " and " << number2 << " is: " << sum << std::endl;

    // Return 0 to indicate successful execution
    return 0;
}