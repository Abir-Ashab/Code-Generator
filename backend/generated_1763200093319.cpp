#include <iostream> // Required for input/output operations (like std::cout and std::cin)

int main() {
    // Declare three integer variables:
    // num1 and num2 will store the numbers entered by the user.
    // sum will store the result of adding num1 and num2.
    int num1, num2, sum;

    // Prompt the user to enter the first number
    std::cout << "Enter the first number: ";
    // Read the first number from the user and store it in num1
    std::cin >> num1;

    // Prompt the user to enter the second number
    std::cout << "Enter the second number: ";
    // Read the second number from the user and store it in num2
    std::cin >> num2;

    // Calculate the sum of num1 and num2, and store the result in sum
    sum = num1 + num2;

    // Display the result to the user
    std::cout << "The sum of " << num1 << " and " << num2 << " is: " << sum << std::endl;

    // Return 0 to indicate successful program execution
    return 0;
}